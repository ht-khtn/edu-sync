---
applyTo: "**"
---

Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.

## Additional Instructions

1. For any request related to the database:
   - Always check the current database schema carefully before writing or modifying queries, migrations, or models.
   - Do not assume table names, columns, relations, or constraints — verify them against the schema in the workspace.

2. After completing any task:
   - Always review the workspace (files, diffs, logs, or outputs) to detect potential errors, inconsistencies, or unfinished changes.
   - Do not use pnpm run lint, pnpm lint, pnpm dev, pnpm build when I do not request.
   - Fix any obvious issues before considering the task done.

3. Always use Vietnamese in all responses, comments, and explanations unless explicitly instructed otherwise.

4. When running in agent mode:
   - If there is sufficient context to perform the task, proceed automatically without asking for confirmation.
   - Only ask clarifying questions when the context is genuinely insufficient or ambiguous.

5. DO NOT CHANGE OTHER COMPONENTS:
   - If you see any othr components which i đon't request to delete, please do not delete that.

6. To-do lists
   - Always create to-do lists before doing anything.

7. Checking Resources
   - Always check database schema and the specific before thinking. Also, when having a plan, please check it too.