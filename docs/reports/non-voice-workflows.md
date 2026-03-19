# Non Voice Workflows

1) Open this REPO in your editor like vscode or cursor.  Cursor has built in claude code so that is highly recommended.
2) Edit [docs/VISION.md](../VISION.md) and describe your dreams for what you want this portfolio to become
3) Create some goals that are aligned to this vision.  Goals are for the benefit of steering the AI Assistants, especially the Chief of Staff, in their higher level decision making and prioritization.  They also exist for you, to help steer YOU toward building only the things that matter

You can create a new goal from a template pretty easily.

```shell
cnotes create goal --meta.horizon=short --title "Public Marketing Presence"
cnotes create goal --title "Release a native iOS Mobile Application"

# validate the docs conform to the structure
cnotes validate
```

## Recording an Idea

Record an idea against one of the goals you set for yourself.  An idea is what you might typically type directly into claude code.  

The Agentic Loop and Chief of Staff will help you take this nugget of an idea and turn it into a proper plan for claude code to execute against autonomously.

```shell
cnotes create idea --title "Marketing Website Idea" --meta.goal=public-marketing-presence
```

## Run the Agentic Loop process

Run this in a terminal and hide it in the dock unless you want to watch what is going on.

```shell
luca main
```

## Talk to the chief of staff

You can run the following command to open up a chat session with the chief of staff

```shell
luca chat chiefOfStaff
```

This is just a terminal chat, the chiefOfStaff can power the entire operation through here.
