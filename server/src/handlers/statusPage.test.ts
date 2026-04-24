import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { StatusMonitorService } from '../services/statusMonitorService';
import { statusPageHandler, uptimeHandler, incidentsHandler, subscribeHandler, unsubscribeHandler } from '../handlers/statusPage';
import prisma from '../utils/db';

// Mock dependencies
vi.mock('../utils/db', () => ({
  default: {
    statusEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    statusSubscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('../services/statusMonitorService', () => ({
  StatusMonitorService: vi.fn().mockImplementation(() => ({
    getCurrentStatus: vi.fn(),
    getUptimeStats: vi.fn(),
    getIncidentHistory: vi.fn(),
  })),
}));

describe('Status Page Handlers', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;
  let mockConfig: any;

  beforeEach(() => {
    mockReq = {
      query: {},
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
    mockConfig = {
      horizonUrl: 'https://horizon-testnet.stellar.org',
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('statusPageHandler', () => {
    it('should return current status', async () => {
      const mockStatus = {
        status: 'operational',
        timestamp: '2026-03-28T12:00:00.000Z',
        components: {
          api: { component: 'api', status: 'operational' },
          horizon: { component: 'horizon', status: 'operational' },
          database: { component: 'database', status: 'operational' },
        },
      };

      const mockMonitor = {
        getCurrentStatus: vi.fn().mockResolvedValue(mockStatus),
      };

      // Mock the static getStatusMonitor method
      const getStatusMonitorSpy = vi.spyOn(
        StatusMonitorService.prototype as any,
        'constructor'
      ).mockImplementation(() => mockMonitor);

      await statusPageHandler(mockReq, mockRes, mockNext, mockConfig);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockStatus);
    });

    it('should return fallback status on error', async () => {
      const mockMonitor = {
        getCurrentStatus: vi.fn().mockRejectedValue(new Error('Database error')),
      };

      const getStatusMonitorSpy = vi.spyOn(
        StatusMonitorService.prototype as any,
        'constructor'
      ).mockImplementation(() => mockMonitor);

      await statusPageHandler(mockReq, mockRes, mockNext, mockConfig);

      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'unknown',
        timestamp: expect.any(String),
        components: {
          api: {
            component: 'api',
            status: 'unknown',
            message: 'Status check failed',
          },
          horizon: {
            component: 'horizon',
            status: 'unknown',
            message: 'Status check failed',
          },
          database: {
            component: 'database',
            status: 'unknown',
            message: 'Status check failed',
          },
        },
      });
    });
  });

  describe('uptimeHandler', () => {
    it('should return uptime statistics', async () => {
      const mockUptime = {
        period: '90 days',
        startDate: '2026-01-28T12:00:00.000Z',
        endDate: '2026-03-28T12:00:00.000Z',
        components: {
          api: { uptime: 99.95 },
          horizon: { uptime: 99.90 },
          database: { uptime: 99.99 },
        },
      };

      mockReq.query.days = '90';

      const mockMonitor = {
        getUptimeStats: vi.fn().mockResolvedValue(mockUptime),
      };

      const getStatusMonitorSpy = vi.spyOn(
        StatusMonitorService.prototype as any,
        'constructor'
      ).mockImplementation(() => mockMonitor);

      await uptimeHandler(mockReq, mockRes, mockNext, mockConfig);

      expect(mockMonitor.getUptimeStats).toHaveBeenCalledWith(90);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockUptime);
    });

    it('should limit days parameter', async () => {
      mockReq.query.days = '400'; // Above max of 365

      const mockMonitor = {
        getUptimeStats: vi.fn().mockResolvedValue({}),
      };

      const getStatusMonitorSpy = vi.spyOn(
        StatusMonitorService.prototype as any,
        'constructor'
      ).mockImplementation(() => mockMonitor);

      await uptimeHandler(mockReq, mockRes, mockNext, mockConfig);

      expect(mockMonitor.getUptimeStats).toHaveBeenCalledWith(365);
    });

    it('should use default days parameter', async () => {
      mockReq.query.days = undefined;

      const mockMonitor = {
        getUptimeStats: vi.fn().mockResolvedValue({}),
      };

      const getStatusMonitorSpy = vi.spyOn(
        StatusMonitorService.prototype as any,
        'constructor'
      ).mockImplementation(() => mockMonitor);

      await uptimeHandler(mockReq, mockRes, mockNext, mockConfig);

      expect(mockMonitor.getUptimeStats).toHaveBeenCalledWith(90);
    });
  });

  describe('incidentsHandler', () => {
    it('should return incident history', async () => {
      const mockIncidents = {
        period: '90 days',
        incidents: [
          {
            id: 'incident-1',
            component: 'horizon',
            status: 'down',
            startedAt: '2026-03-27T10:00:00.000Z',
            resolvedAt: '2026-03-27T11:30:00.000Z',
            durationMinutes: 90,
            message: 'Horizon API timeout',
          },
        ],
      };

      mockReq.query.days = '90';

      const mockMonitor = {
        getIncidentHistory: vi.fn().mockResolvedValue(mockIncidents),
      };

      const getStatusMonitorSpy = vi.spyOn(
        StatusMonitorService.prototype as any,
        'constructor'
      ).mockImplementation(() => mockMonitor);

      await incidentsHandler(mockReq, mockRes, mockNext, mockConfig);

      expect(mockMonitor.getIncidentHistory).toHaveBeenCalledWith(90);
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith(mockIncidents);
    });
  });

  describe('subscribeHandler', () => {
    it('should create new subscription', async () => {
      mockReq.body = { email: 'test@example.com' };

      const mockSubscription = {
        id: 'sub-123',
        email: 'test@example.com',
        active: true,
      };

      (prisma.statusSubscription.findUnique as any).mockResolvedValue(null);
      (prisma.statusSubscription.create as any).mockResolvedValue(mockSubscription);

      await subscribeHandler(mockReq, mockRes, mockNext);

      expect(prisma.statusSubscription.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.statusSubscription.create).toHaveBeenCalledWith({
        data: {
          email: 'test@example.com',
          active: true,
        },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Successfully subscribed to status updates',
        subscriptionId: 'sub-123',
      });
    });

    it('should reactivate existing inactive subscription', async () => {
      mockReq.body = { email: 'test@example.com' };

      const existingSubscription = {
        id: 'sub-123',
        email: 'test@example.com',
        active: false,
      };

      (prisma.statusSubscription.findUnique as any).mockResolvedValue(existingSubscription);
      (prisma.statusSubscription.update as any).mockResolvedValue({
        ...existingSubscription,
        active: true,
      });

      await subscribeHandler(mockReq, mockRes, mockNext);

      expect(prisma.statusSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { active: true },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Successfully reactivated subscription',
        subscriptionId: 'sub-123',
      });
    });

    it('should return 409 for already subscribed email', async () => {
      mockReq.body = { email: 'test@example.com' };

      const existingSubscription = {
        id: 'sub-123',
        email: 'test@example.com',
        active: true,
      };

      (prisma.statusSubscription.findUnique as any).mockResolvedValue(existingSubscription);

      await subscribeHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(409);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Email already subscribed to status updates',
      });
    });

    it('should return 400 for invalid email', async () => {
      mockReq.body = { email: 'invalid-email' };

      await subscribeHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Invalid email address',
      });
    });

    it('should return 400 for missing email', async () => {
      mockReq.body = {};

      await subscribeHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Email address is required',
      });
    });
  });

  describe('unsubscribeHandler', () => {
    it('should unsubscribe existing email', async () => {
      mockReq.body = { email: 'test@example.com' };

      const existingSubscription = {
        id: 'sub-123',
        email: 'test@example.com',
        active: true,
      };

      (prisma.statusSubscription.findUnique as any).mockResolvedValue(existingSubscription);
      (prisma.statusSubscription.update as any).mockResolvedValue({
        ...existingSubscription,
        active: false,
      });

      await unsubscribeHandler(mockReq, mockRes, mockNext);

      expect(prisma.statusSubscription.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
      expect(prisma.statusSubscription.update).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: { active: false },
      });
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Successfully unsubscribed from status updates',
      });
    });

    it('should return 404 for non-existent email', async () => {
      mockReq.body = { email: 'nonexistent@example.com' };

      (prisma.statusSubscription.findUnique as any).mockResolvedValue(null);

      await unsubscribeHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Email not found in subscription list',
      });
    });

    it('should return 400 for missing email', async () => {
      mockReq.body = {};

      await unsubscribeHandler(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        message: 'Email address is required',
      });
    });
  });
});
