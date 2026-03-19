# The Agentic Loop
> AI Software Portfolio Management 

1) You Define a vision. You Establish goals.

2) You Record your ideas.

3) Work with an Assistant ( through chat ) to help align your ideas to your goals and gain clarity.

4) Turn your ideas into Projects that can be built and deployed into the world.

## What is this repository?

This is essentially an AI Assisted, structured writing exercise that takes place over time, the byproduct of which can be software products or ongoing agentic workflow automation.  It is completely up to you.

AI Coding assistants are a blast to work with, and highly addictive.  This project allows for more asynchronous, thoughtful, and indirect relationship with them that takes place through longer form written exchange. 

## Installation and Requirements

- NOTE: For the offline voice transcription / wake word system to work, it is assumed you have an Apple Silicon M3 or better.  If you do not, this system still works just without the voice transcription.  Luca does have downgraded TTS / STT options but they are not setup currently ( you could ask claude code to do it for you )
- setup requires homebrew on a mac
- setup requires `claude` ( brew install claude-code ) 
- downloads [luca](https://github.com/soederpop/luca) and [contentbase](https://github.com/soederpop/luca) via bun install.  
- copy `.env.example` to `.env` and put in real values

**quick path fix**

Add the following to your `~/.zshrc`

```zsh
export PATH=./node_modules/.bin:$PATH
```

and then run `source ~/.zshrc` so the changes take effect.
 
As long as you have the `claude` code CLI installed and in your path, to get started with the rest of the installation, run the following:

```shell
sh setup.sh
```

## A Visual Explainer

Run the following to view a visual explainer:

```
luca serve
```


## Native OSX App and Voice Command System

This project [contains a Native OSX App](./apps/presenter-windows/) whose only role is to open up browser windows, or terminal commands inside a pretty terminal window.  Assistants can "present" URLs to you.  You can write your own voice comand handlers to spawn terminal processes.

The [Voice Command Handlers](./commands/voice/handlers) are modules which match command utterances picked up by the `luca main` voice system and route them to handler functions, which you can write to trigger certain commands in the system.

### Voice Setup

Running the following will tell you if your system supports it:

```shell
luca voice --check
```

Voice mode requires **two wake words** — you'll record samples of your voice for each:

1. **"yo chief"** or **"hey chief"** — activates the **Chief of Staff** assistant (must contain the word "chief")
2. **Your choice** (e.g. "hey friday") — activates the general **voice command router**

Run the guided setup (requires `rustpotter` in your PATH):

```shell
./voice/wakeword/setup-wakeword.sh
```

This walks you through recording 5 samples of each wake word and builds the detection models. You can also set up a single wake word directly:

```shell
./voice/wakeword/setup-wakeword.sh "yo chief"
```

### Testing Voice

Run the following to test if the voice system works:

```shell
luca TEST-VOICE-MODE
```

The `luca train --voice` command will open up a web app to help you iterate on voice command handlers.


## Project Commands

The following are things you can run from the terminal to interact with the Agentic Loop process.

The `luca` cli will run any `commands/whatever.ts` folder as `luca whatever`.  

Run `luca scaffold command --tutorial` to get an idea for what a command looks like.

**IN GENERAL** if you have a question about the `luca` CLI , ask `claude` as it is loaded with the skills.

```shell
# run this with no args for a help 
luca
# the describe command can teach you about any of the components
luca describe --help 
# the scaffold command can create new features, commands, assistants
luca scaffold --help
```

### The Main Agentic Loop Process

Run the [main agentic loop process](./commands/main.ts) ( long lived server essentially ).  It is also possible to run this with launchctl on startup on your mac.

```shell
luca main
```

This process is a system wide singleton and uses a locking mechanism to ensure only one is running.

If you run this same command in another terminal, you will get a dashboard that views the activity.

You can pause / unpause the agentic loop with the following:

```shell
luca main --pause
luca main --resume # when you're ready for it to start back up again
```

You can also connect to it via a REPL

```shell
luca main --console
```

### Chat with an Assistant

To chat with the chief of staff using a text interface ( this is a good way to test tools you're adding )

```shell
luca chat chiefOfStaff
```

The chief has the ability to make anything happen.

### The Project Builder

The main agentic loop process will be running this headlessly, but this utility is a good way to bundle up multiple claude code sessions and run them in sequence

```shell
luca project-builder $project-slug # e.g if you have docs/projects/marketing-website.md marketing-website is the slug
```

### Run a prompt document through a coding assistant

Rather than "chatting" with Claude code, it is best to write a prompt document in markdown.  You can then run the prompt

```shell
luca prompt claude|codex|chiefOfStaff docs/prompts/whatever.md
```

## Contentbase

As the [folder of docs grows](./docs), and it should if the loop is running, contentbase provides organization structure and the ability to query, and perform bulk operations on these documents, summarize them, extract only certain sections, and more.

Run the following for a full help

```shell
cnotes --help
```

### Validating Documents

The following command will validate the documents produced by you, or the agents, follow the structure we need them to

```shell
cnotes validate
```



