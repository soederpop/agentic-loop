# Project Builder - Any Assistant 

The Project Builder right now is hard coded to use the claude code feature.

Which is fine for the default.  

But I should be able to put an assistant: researcher or assistant: lucaCoder and have it dispatch to them.  

I tested out being able to `luca prompt researcher docs/tasks/test-researcher-prompt.md` and it worked.

So, when it isn't to claude, or codex, we can use the shell to `luca prompt` to execute the plan. 

I would still expect the output of the run to be appended to the project builds folder for debugging purpose.

The same should be true for the task-scheduler, as i notice the playbook designer is also constrained to just the two coding assistants.

I have claude working on this in another thread.