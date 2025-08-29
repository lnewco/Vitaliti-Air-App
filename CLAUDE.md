# CLAUDE.md

Start by reading README.md for project context.

## Code Guidelines

### When Modifying
1. Follow best practices
2. Update docs for behavior changes
3. Don't commit without user request

### Best Practices
- Use theme tokens, no hardcoded values
- Don't repeat code - extract shared logic into hooks/utils
- Extract business logic from UI into services
- Use descriptive names over comments
- Use async/await over promise chains
- Keep components focused - one clear purpose each

## Documentation Guidelines

- Docs are maps for LLMs - show where things are, not what they contain
- Never duplicate code or constants in docs
- Update existing docs when possible, create new only if needed
- Keep concise - focus on relationships, not implementation details