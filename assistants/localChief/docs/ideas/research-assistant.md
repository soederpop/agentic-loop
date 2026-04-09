---
goal: have-10-users-of-the-agentic-loop
tags: []
status: exploring
---

# Research Assistant

I’ve scaffolded an assistant in assistants/researcher

This assistant can use(container.feature(‘browserUse’)) and have access to a web browser

I think we can use a ContentBase model for a Report as the guiding document for the Top Level Researcher assistant.

This assistant needs to be able to spawn ( using the assistants subagent mechanism ) new research assistants, to be able to tackle a large research effort in parallel

Contentbase Research reports should save their intermediate state in the report itself, and use contentbase extraction tools to work with it as data 

The TopLevel Research assistant should have tools for building structured research plans, which the sub-assistants can work off of and fill in ( or generate their own documents )

Research Assistants should be somewhat recursive to a degree.

The final output could be a single markdown document, or a folder of linked markdown documents, which we can turn into an indepdent contentbase collection 

The final output could contain writing, links, references, and other data which can be used to build visualizations, slides / presentations, and other visual ways of consuming the results
