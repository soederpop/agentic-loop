---
agent: claude
createdBy: chief
tags:
  - tools
  - git
  - assistant-capability
running: false
lastRanAt: 1774342291571
---

# Add Single File Commit Tool

Add a tool that allows Chief to commit exactly one file immediately after writing it.

Requirements:

* The tool must accept exactly two inputs:
  * file path
  * commit message
* It should only allow committing one file at a time.
* It should stage and commit only the specified file, not any other working tree changes.
* It should be safe for use right after `updateDocument` writes a file.
* It should work well for docs edits like the one Chief just made.

Concrete example to support:

* File: `docs/memories/SELF.md`
* Commit message: `Add memory to refresh before answering time-sensitive questions`

## Conditions

* If a tool with this exact capability already exists, do not add a duplicate; instead document how Chief should use the existing tool for single-file commits.
* If implementing the tool requires changes in multiple layers, include usage notes and guardrails so Chief cannot accidentally commit more than one file.
