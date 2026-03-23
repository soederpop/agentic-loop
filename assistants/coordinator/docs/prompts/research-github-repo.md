---
inputs:
    repo:
        description: Enter the github repo (e.g. soederpop/luca)
        type: input
agentOptions:
    chrome: true
    allowedTools:
        - WebFetch
        - "Bash(gh *)"
---
# Research Github Repo

Please look at the website for {{repo}} and explain what it does.
