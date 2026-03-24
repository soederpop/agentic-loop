---
agent: claude
createdBy: chief
tags:
  - project-builder
  - browser-use
  - ui
  - markdown
running: false
lastRanAt: 1774344857312
---

# Fix Project Builder Project Overview Rendering

Use your browser-use skill to start the `project-builder` workflow in development mode and inspect the project details UI.

The issue:

* When looking at a project's details, the project overview and related project document content do **not** show as rendered markdown.
* The plans do appear to render correctly.

Please:

* Start the `project-builder` workflow in development mode
* Open a project details page in the browser
* Compare how the project overview/content is displayed versus how plans are displayed
* Identify why the project document is not being rendered as markdown
* Fix the issue so the project overview/details render like formatted markdown, consistent with the plans view
* Verify in the browser that the project details page now renders correctly

## Conditions

* If the workflow name or startup command differs from expectations, first discover the correct way to run it in development mode, then proceed.
* If the project details view intentionally uses a different renderer, document that and make the rendering consistent unless there is a strong reason not to.
