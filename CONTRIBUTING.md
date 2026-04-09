# Contributing to Fluid

## Git Workflow

We follow a feature branch workflow to maintain code quality and ensure proper review process.

### Branch Naming Convention

- `feature/feature-name` - New features
- `bugfix/bug-description` - Bug fixes
- `hotfix/urgent-fix` - Critical fixes
- `docs/documentation-update` - Documentation changes

### Workflow Steps

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, documented code
   - Follow existing code style
   - Add tests when appropriate

3. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: descriptive commit message"
   ```

4. **Push to remote**
   ```bash
   git push -u origin feature/your-feature-name
   ```

5. **Create a Pull Request**
   - Provide clear description of changes
   - Link related issues
   - Request review from maintainers

6. **Code Review**
   - Address feedback promptly
   - Keep PR updated with latest changes

7. **Merge**
   - Only merge after approval
   - Use squash merge for clean history
   - Delete feature branch after merge

### Commit Message Convention

We use conventional commits:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Example:
```
feat: implement secure admin authentication with nextauth.js (#63)
```

### Main Branch Protection

- **Direct pushes to main are disabled**
- **All changes must go through Pull Requests**
- **PRs require at least one review**
- **CI/CD must pass before merge**

### Development Setup

1. Fork the repository
2. Clone your fork
3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/devcarole/fluid.git
   ```
4. Keep your fork updated:
   ```bash
   git checkout main
   git pull upstream main
   ```

### Code Quality

- Follow TypeScript best practices
- Use meaningful variable names
- Add JSDoc comments for complex functions
- Ensure no `console.log` in production code
- Follow existing project structure

Thank you for contributing to Fluid! 🚀

## Changesets (Versioning & Changelogs)

This monorepo uses **Changesets** to manage **independent package versions** and per-package **CHANGELOG.md** entries.

### When to add a changeset

Add a changeset in the same PR whenever you make a user-visible change to any package (client, server, dashboards, etc.).

### How to add a changeset

From the repo root:

```bash
npm run changeset
```

Then:

- Select the packages your change affects
- Choose the bump type (patch/minor/major)
- Write a short, clear summary of the change

### CI / Release flow

On merge to `main`, the release workflow will:

- Open/maintain a “Version Packages” PR when changesets exist
- Bump package versions and update changelogs
- Publish packages (requires `NPM_TOKEN` configured in repo secrets)
