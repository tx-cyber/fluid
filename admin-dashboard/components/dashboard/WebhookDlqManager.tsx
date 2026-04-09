"use client";

import { useState } from "react";
import type { WebhookDlqItem } from "@/components/dashboard/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function WebhookDlqManager({
  initialItems,
}: {
  initialItems: WebhookDlqItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionState, setActionState] = useState<{
    loading: boolean;
    error: string | null;
    success: string | null;
  }>({ loading: false, error: null, success: null });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(items.map((item) => item.id)));
    }
  };

  const handleAction = async (action: "replay" | "delete") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    setActionState({ loading: true, error: null, success: null });

    try {
      const response = await fetch("/api/admin/webhooks/dlq", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? `Failed to ${action} DLQ items`);
      }

      setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());

      const count = action === "replay"
        ? payload.results?.filter((r: { status: string }) => r.status === "replayed").length ?? ids.length
        : payload.deleted ?? ids.length;

      setActionState({
        loading: false,
        error: null,
        success: `${count} item${count !== 1 ? "s" : ""} ${action === "replay" ? "replayed" : "deleted"}`,
      });
    } catch (error) {
      setActionState({
        loading: false,
        error: error instanceof Error ? error.message : `Failed to ${action}`,
        success: null,
      });
    }
  };

  const formatPayload = (payload: string) => {
    try {
      return JSON.stringify(JSON.parse(payload), null, 2);
    } catch {
      return payload;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Dead-Letter Queue</CardTitle>
            <CardDescription>
              {items.length} failed webhook{items.length !== 1 ? "s" : ""} awaiting action
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleAction("replay")}
              disabled={selectedIds.size === 0 || actionState.loading}
            >
              {actionState.loading ? "Processing..." : `Replay selected (${selectedIds.size})`}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => void handleAction("delete")}
              disabled={selectedIds.size === 0 || actionState.loading}
            >
              Delete selected ({selectedIds.size})
            </Button>
          </div>
        </div>
        {actionState.success && (
          <p className="text-sm text-emerald-600">{actionState.success}</p>
        )}
        {actionState.error && (
          <p className="text-sm text-red-600">{actionState.error}</p>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No items in the dead-letter queue.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Error</TableHead>
                <TableHead>Retries</TableHead>
                <TableHead>Failed At</TableHead>
                <TableHead>Expires At</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <>
                  <TableRow key={item.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleSelection(item.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.tenantName}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                      {item.url}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-red-600">
                      {item.lastError ?? "Unknown error"}
                    </TableCell>
                    <TableCell>{item.retryCount}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.failedAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.expiresAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setExpandedId(expandedId === item.id ? null : item.id)
                        }
                      >
                        {expandedId === item.id ? "Hide" : "Payload"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedId === item.id && (
                    <TableRow key={`${item.id}-payload`}>
                      <TableCell colSpan={8} className="bg-slate-50">
                        <pre className="max-h-48 overflow-auto rounded bg-slate-100 p-3 text-xs">
                          {formatPayload(item.payload)}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
