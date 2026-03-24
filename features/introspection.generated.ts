import { setBuildTimeData } from '@soederpop/luca/introspection';

// Auto-generated introspection registry data
// Generated at: 2026-03-21T05:32:50.808Z

setBuildTimeData('features.gws', {
  "id": "features.gws",
  "description": "Google Workspace CLI wrapper providing access to the full GWS API surface via subprocess. Supports profile-based credential management and typed sub-interfaces for Gmail, Sheets, Calendar, Drive, Docs, and Chat.",
  "shortcut": "features.gws",
  "className": "Gws",
  "methods": {
    "isAvailable": {
      "description": "Checks whether the GWS CLI binary can be resolved on this system.",
      "parameters": {},
      "required": [],
      "returns": "Promise<boolean>"
    },
    "version": {
      "description": "Returns the installed GWS CLI version string.",
      "parameters": {},
      "required": [],
      "returns": "Promise<string>"
    },
    "exec": {
      "description": "Executes an arbitrary GWS CLI command. Accepts path segments and an optional trailing options object.",
      "parameters": {
        "segments": {
          "type": "[...string[], GwsExecOptions] | string[]",
          "description": "Parameter segments"
        }
      },
      "required": [
        "segments"
      ],
      "returns": "Promise<any>"
    },
    "helper": {
      "description": "Executes a GWS CLI helper command (e.g. `gws gmail +send`). Helpers use --key value args instead of --params JSON.",
      "parameters": {
        "service": {
          "type": "string",
          "description": "Parameter service"
        },
        "helperName": {
          "type": "string",
          "description": "Parameter helperName"
        },
        "options": {
          "type": "GwsExecOptions",
          "description": "Parameter options",
          "properties": {
            "params": {
              "type": "Record<string, string | number | boolean>",
              "description": ""
            },
            "flags": {
              "type": "string[]",
              "description": ""
            },
            "json": {
              "type": "boolean",
              "description": ""
            },
            "ndjson": {
              "type": "boolean",
              "description": ""
            },
            "profile": {
              "type": "string",
              "description": ""
            }
          }
        }
      },
      "required": [
        "service",
        "helperName"
      ],
      "returns": "Promise<any>"
    },
    "useProfile": {
      "description": "Activates a named credential profile. Throws if the profile directory does not exist.",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        }
      },
      "required": [
        "name"
      ],
      "returns": "void"
    },
    "clearProfile": {
      "description": "Clears the active credential profile so subsequent commands use default credentials.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "useCredentials": {
      "description": "Points all subsequent commands at a specific credentials file path, bypassing the profile system.",
      "parameters": {
        "path": {
          "type": "string",
          "description": "Parameter path"
        }
      },
      "required": [
        "path"
      ],
      "returns": "void"
    },
    "profiles": {
      "description": "Lists all available credential profile names found in the profiles directory.",
      "parameters": {},
      "required": [],
      "returns": "string[]"
    }
  },
  "getters": {
    "currentProfile": {
      "description": "Returns the name of the currently active credential profile, or null if none is set.",
      "returns": "string | null"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.voiceRouter', {
  "id": "features.voiceRouter",
  "description": "Routes spoken voice commands to the appropriate handler or conversational assistant. Manages handler loading, phrase playback, workspace resolution, and conversation mode.",
  "shortcut": "features.voiceRouter",
  "className": "VoiceRouter",
  "methods": {
    "start": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "loadHandlers": {
      "description": "Scans the voice handlers directory, imports each handler module, and sorts by priority.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "loadPhraseManifest": {
      "description": "Loads phrase manifest from the voice-assistant and indexes entries by tag.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "randomPhrase": {
      "description": "Returns a random phrase file path for the given tag, avoiding repeats.",
      "parameters": {
        "tag": {
          "type": "string",
          "description": "Parameter tag"
        }
      },
      "required": [
        "tag"
      ],
      "returns": "string | null"
    },
    "playPhrase": {
      "description": "Plays a random audio phrase for the given tag using afplay.",
      "parameters": {
        "tag": {
          "type": "string",
          "description": "Parameter tag"
        }
      },
      "required": [
        "tag"
      ],
      "returns": "void"
    },
    "loadAssistantPhrases": {
      "description": "Loads phrase manifest from an assistant folder and indexes entries by tag.",
      "parameters": {
        "folder": {
          "type": "string",
          "description": "Parameter folder"
        }
      },
      "required": [
        "folder"
      ],
      "returns": "void"
    },
    "playAssistantPhrase": {
      "description": "Plays a random phrase from the loaded assistant manifest for the given tag.",
      "parameters": {
        "tag": {
          "type": "string",
          "description": "Parameter tag"
        }
      },
      "required": [
        "tag"
      ],
      "returns": "void"
    },
    "loadWorkspaceMap": {
      "description": "Build a map of all local packages and their voice-friendly aliases from the `luca.aliases` field in each package.json.",
      "parameters": {},
      "required": [],
      "returns": "Promise<WorkspaceEntry[]>"
    },
    "resolveWorkspace": {
      "description": "Resolve a spoken term to a workspace entry by matching against aliases. Returns null if no alias matches.",
      "parameters": {
        "term": {
          "type": "string",
          "description": "Parameter term"
        }
      },
      "required": [
        "term"
      ],
      "returns": "WorkspaceEntry | null"
    },
    "reloadHandlers": {
      "description": "Clears all loaded handlers and reloads them from disk.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "watchHandlers": {
      "description": "Watches the handlers directory for changes and auto-reloads when files are added, changed, or deleted.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "stopWatchingHandlers": {
      "description": "Stops watching the handlers directory.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "startPollingReload": {
      "description": "Polls for handler changes every 30 seconds so iterating during demos picks up new code.",
      "parameters": {
        "intervalMs": {
          "type": "any",
          "description": "Parameter intervalMs"
        }
      },
      "required": [],
      "returns": "void"
    },
    "stopPollingReload": {
      "description": "Stops the polling reload interval.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "route": {
      "description": "Routes a voice command to the first matching handler, or to the conversational assistant if in conversation mode.",
      "parameters": {
        "cmd": {
          "type": "CommandHandle",
          "description": "Parameter cmd"
        }
      },
      "required": [
        "cmd"
      ],
      "returns": "Promise<{ matched: boolean; ctx: HandlerContext; cmd: CommandHandle }>"
    },
    "inspect": {
      "description": "Dry-runs a voice command against all handlers and returns match diagnostics including parsed utterance and dictionary hits.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        }
      },
      "required": [
        "text"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "isRouting": {
      "description": "",
      "returns": "boolean"
    },
    "workspaceMap": {
      "description": "Returns the loaded workspace entries with their voice-friendly aliases.",
      "returns": "WorkspaceEntry[]"
    },
    "handlerFiles": {
      "description": "Returns the list of loaded handler names and their source file paths.",
      "returns": "Array<{ name: string; file: string }>"
    },
    "manifest": {
      "description": "Returns a manifest of all loaded handlers with their name, description, keywords, and priority.",
      "returns": "Array<{ name: string; description: string; keywords: string[]; priority: number }>"
    },
    "phraseTags": {
      "description": "",
      "returns": "string[]"
    }
  },
  "events": {
    "handlerFinished": {
      "name": "handlerFinished",
      "description": "Event emitted by VoiceRouter",
      "arguments": {}
    },
    "handlerError": {
      "name": "handlerError",
      "description": "Event emitted by VoiceRouter",
      "arguments": {}
    },
    "routeFinished": {
      "name": "routeFinished",
      "description": "Event emitted by VoiceRouter",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.voiceChat', {
  "id": "features.voiceChat",
  "description": "Standalone conversational voice chat feature. Wraps an Assistant + SpeechStreamer pair for streaming TTS conversations. Can be instantiated with any assistant folder, voice, and settings.",
  "shortcut": "features.voiceChat",
  "className": "VoiceChat",
  "methods": {
    "start": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "mute": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "unmute": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "wireUpResponseEvents": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "readVoiceConfig": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "checkCapabilities": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<CapabilityResult>"
    },
    "speakPhrase": {
      "description": "",
      "parameters": {
        "phrase": {
          "type": "string",
          "description": "Parameter phrase"
        }
      },
      "required": [
        "phrase"
      ],
      "returns": "void"
    },
    "createSpeechStreamer": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "loadPhraseManifest": {
      "description": "Loads the phrase manifest JSON from the assistant's generated folder and indexes by tag.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "randomPhrase": {
      "description": "Returns a random phrase file path for the given tag, avoiding repeats.",
      "parameters": {
        "tag": {
          "type": "string",
          "description": "Parameter tag"
        }
      },
      "required": [
        "tag"
      ],
      "returns": "string | null"
    },
    "playPhrase": {
      "description": "Plays a random audio phrase for the given tag using afplay.",
      "parameters": {
        "tag": {
          "type": "string",
          "description": "Parameter tag"
        }
      },
      "required": [
        "tag"
      ],
      "returns": "void"
    },
    "say": {
      "description": "Send a message to the assistant and stream the response as speech. Returns the full text response.",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<string>"
    },
    "ask": {
      "description": "Ask the assistant a question. Alias for say().",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<string>"
    },
    "playToolcallPhrase": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "playToolResultPhrase": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "playToolErrorPhrase": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "assistantsManager": {
      "description": "",
      "returns": "AssistantsManager"
    },
    "assistant": {
      "description": "",
      "returns": "Assistant"
    },
    "isMuted": {
      "description": "",
      "returns": "boolean"
    },
    "isStarted": {
      "description": "",
      "returns": "boolean"
    },
    "isConversing": {
      "description": "Whether the chat is currently in conversation mode.",
      "returns": "boolean"
    },
    "voiceConfig": {
      "description": "",
      "returns": "VoiceConfig"
    }
  },
  "events": {
    "info": {
      "name": "info",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    },
    "started": {
      "name": "started",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    },
    "debug": {
      "name": "debug",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    },
    "toolCall": {
      "name": "toolCall",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    },
    "toolResult": {
      "name": "toolResult",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    },
    "toolError": {
      "name": "toolError",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    },
    "finished": {
      "name": "finished",
      "description": "Event emitted by VoiceChat",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.imsg', {
  "id": "features.imsg",
  "description": "Wrapper around the imsg CLI for iMessage. Provides programmatic access to list chats, read history, send messages, react, and watch for incoming messages.",
  "shortcut": "features.imsg",
  "className": "Imsg",
  "methods": {
    "chats": {
      "description": "List recent conversations",
      "parameters": {
        "opts": {
          "type": "{ limit?: number }",
          "description": "Parameter opts"
        }
      },
      "required": [],
      "returns": "Promise<Chat[]>"
    },
    "history": {
      "description": "Get message history for a chat",
      "parameters": {
        "chatId": {
          "type": "number",
          "description": "Parameter chatId"
        },
        "opts": {
          "type": "HistoryOptions",
          "description": "Parameter opts",
          "properties": {
            "limit": {
              "type": "number",
              "description": ""
            },
            "participants": {
              "type": "string",
              "description": ""
            },
            "start": {
              "type": "string",
              "description": ""
            },
            "end": {
              "type": "string",
              "description": ""
            },
            "attachments": {
              "type": "boolean",
              "description": ""
            }
          }
        }
      },
      "required": [
        "chatId"
      ],
      "returns": "Promise<Message[]>"
    },
    "send": {
      "description": "Send a text message to a phone number/email or chat ID",
      "parameters": {
        "to": {
          "type": "string",
          "description": "Parameter to"
        },
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "opts": {
          "type": "{ file?: string; service?: string; chatId?: number }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "to",
        "text"
      ],
      "returns": "Promise<SendResult>"
    },
    "react": {
      "description": "Send a tapback reaction to the most recent message in a chat",
      "parameters": {
        "chatId": {
          "type": "number",
          "description": "Parameter chatId"
        },
        "reaction": {
          "type": "string",
          "description": "Parameter reaction"
        }
      },
      "required": [
        "chatId",
        "reaction"
      ],
      "returns": "Promise<SendResult>"
    },
    "watch": {
      "description": "Watch for incoming messages. Returns an abort function to stop watching.",
      "parameters": {
        "opts": {
          "type": "WatchOptions",
          "description": "Parameter opts",
          "properties": {
            "chatId": {
              "type": "number",
              "description": ""
            },
            "participants": {
              "type": "string",
              "description": ""
            },
            "sinceRowid": {
              "type": "number",
              "description": ""
            },
            "attachments": {
              "type": "boolean",
              "description": ""
            },
            "reactions": {
              "type": "boolean",
              "description": ""
            },
            "debounce": {
              "type": "string",
              "description": ""
            },
            "onMessage": {
              "type": "(msg: Message) => void",
              "description": ""
            },
            "onError": {
              "type": "(err: string) => void",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<{ stop: () => void }>"
    }
  },
  "getters": {},
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const imsg = container.feature('imsg')\nconst chats = await imsg.chats({ limit: 5 })\nconst messages = await imsg.history(6, { limit: 10 })\nawait imsg.send('+15551234567', 'Hello from luca')"
    }
  ]
});

setBuildTimeData('features.projectBuilder', {
  "id": "features.projectBuilder",
  "description": "ProjectBuilder Feature Loads contentbase projects and their plans, executes them sequentially via Claude Code sessions, caches results, writes build reports, and persists plan completion status back to the markdown files. Supports cross-process operation via IPC: - **server** mode: runs the build, broadcasts events, handles requests - **client** mode: proxies commands to the server, relays events locally - **standalone** mode: operates independently (default) Auto-detection: on creation, probes `tmp/project-builder.sock` — if reachable, enters client mode; otherwise standalone (promotable to server). Events: build:loaded   - Project and plans loaded from contentbase build:start    - Build execution starting build:complete - All plans finished successfully build:error    - A plan failed, stopping the build build:aborting - Abort requested, killing active session build:aborted  - Build was manually aborted plan:skipped   - Plan was already completed, skipping plan:queued    - Plan is next in the execution queue plan:start     - Plan execution started (Claude Code session spawned) plan:delta     - Streaming text delta from the plan's Claude session plan:message   - Full message from the plan's Claude session plan:complete  - Plan finished successfully plan:error     - Plan execution failed",
  "shortcut": "features.projectBuilder",
  "className": "ProjectBuilder",
  "methods": {
    "whenReady": {
      "description": "Returns a promise that resolves when auto-detection and initial hydration (client connect or disk snapshot load) is complete.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "afterInitialize": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "emit": {
      "description": "",
      "parameters": {
        "event": {
          "type": "string",
          "description": "Parameter event"
        },
        "args": {
          "type": "any[]",
          "description": "Parameter args"
        }
      },
      "required": [
        "event",
        "args"
      ],
      "returns": "void"
    },
    "startServer": {
      "description": "Start the IPC server. Listens on the socket path and accepts client connections. Should be called from the authoritative process (e.g. `luca project-builder`).",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "stopServer": {
      "description": "Stop the IPC server and clean up the socket file.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "sendRequest": {
      "description": "Send a request to the IPC server and wait for the correlated response.",
      "parameters": {
        "method": {
          "type": "string",
          "description": "Parameter method"
        },
        "args": {
          "type": "any",
          "description": "Parameter args"
        }
      },
      "required": [
        "method"
      ],
      "returns": "Promise<any>"
    },
    "load": {
      "description": "Load the project and its plans from contentbase. Discovers the execution order, resolves plan documents, and restores cached data for previously completed plans. In client mode, proxies the request to the server.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "run": {
      "description": "Execute all pending plans sequentially via Claude Code sessions. Already-completed plans are skipped. Emits events for each lifecycle stage. Stops on the first plan error. In client mode, proxies the request to the server.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "abort": {
      "description": "Abort the current build execution. Kills the active Claude Code session and resets build status to ready. In client mode, proxies the request to the server.",
      "parameters": {},
      "required": [],
      "returns": "Promise<void>"
    },
    "startWatcher": {
      "description": "Start polling for approved projects. Each approved project gets a ProjectBuilder instance that loads and runs its plans. Completed or already-in-progress projects are skipped.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "stopWatcher": {
      "description": "Stop the watcher. Does not abort in-progress builds.",
      "parameters": {},
      "required": [],
      "returns": "this"
    }
  },
  "getters": {
    "buildStatus": {
      "description": "Current build status.",
      "returns": "BuildStatus"
    },
    "currentPlanId": {
      "description": "ID of the plan currently being executed.",
      "returns": "string | null"
    },
    "isLoaded": {
      "description": "Whether the project has been loaded.",
      "returns": "boolean"
    },
    "isIdle": {
      "description": "Whether the builder is idle (not actively running a build).",
      "returns": "boolean"
    },
    "isClient": {
      "description": "Whether this instance is operating as an IPC client.",
      "returns": "boolean"
    },
    "isServer": {
      "description": "Whether this instance is operating as an IPC server.",
      "returns": "boolean"
    },
    "resolvedSocketPath": {
      "description": "Resolved absolute path for the IPC socket.",
      "returns": "string"
    },
    "buildsInProgress": {
      "description": "Currently building project slugs.",
      "returns": "string[]"
    }
  },
  "events": {
    "build:loaded": {
      "name": "build:loaded",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:skipped": {
      "name": "plan:skipped",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "build:start": {
      "name": "build:start",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "build:complete": {
      "name": "build:complete",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:delta": {
      "name": "plan:delta",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:message": {
      "name": "plan:message",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:queued": {
      "name": "plan:queued",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:start": {
      "name": "plan:start",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:error": {
      "name": "plan:error",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "build:error": {
      "name": "build:error",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "plan:complete": {
      "name": "plan:complete",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "build:aborting": {
      "name": "build:aborting",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "build:aborted": {
      "name": "build:aborted",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:started": {
      "name": "watcher:started",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:stopped": {
      "name": "watcher:stopped",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:building": {
      "name": "watcher:building",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:error": {
      "name": "watcher:error",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:build:error": {
      "name": "watcher:build:error",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:build:skipped": {
      "name": "watcher:build:skipped",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    },
    "watcher:build:start": {
      "name": "watcher:build:start",
      "description": "Event emitted by ProjectBuilder",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.voiceListener', {
  "id": "features.voiceListener",
  "description": "WhisperMLX server side based listener",
  "shortcut": "features.voiceListener",
  "className": "VoiceListener",
  "methods": {
    "lock": {
      "description": "Lock the listener, preventing it from reacting to wakewords until it is unlocked",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "unlock": {
      "description": "Unlock the listener, allowing it to react to wakewords",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "checkCapabilities": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "Promise<CapabilityResult>"
    },
    "stopWaitingForTriggerWord": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "react": {
      "description": "",
      "parameters": {
        "wakeword": {
          "type": "string",
          "description": "Parameter wakeword"
        }
      },
      "required": [
        "wakeword"
      ],
      "returns": "void"
    },
    "waitForTriggerWord": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "listen": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ silenceTimeout?: number }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<string>"
    }
  },
  "getters": {
    "isLocked": {
      "description": "",
      "returns": "any"
    },
    "currentInputVolume": {
      "description": "Get the current input volume",
      "returns": "number"
    },
    "modelsDir": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {
    "locked": {
      "name": "locked",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "unlocked": {
      "name": "unlocked",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "triggerWord": {
      "name": "triggerWord",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "triggerWordErrorOutput": {
      "name": "triggerWordErrorOutput",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "info": {
      "name": "info",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "skippedTriggerWord": {
      "name": "skippedTriggerWord",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "vu": {
      "name": "vu",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "output": {
      "name": "output",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "recording:start": {
      "name": "recording:start",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "recording:stop": {
      "name": "recording:stop",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    },
    "preview": {
      "name": "preview",
      "description": "Event emitted by VoiceListener",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const voiceListener = container.feature('voiceListener')"
    }
  ]
});

setBuildTimeData('features.voiceService', {
  "id": "features.voiceService",
  "description": "Orchestrates the voice subsystem: VoiceRouter, launcher listener, and window manager.",
  "shortcut": "features.voiceService",
  "className": "VoiceService",
  "methods": {
    "start": {
      "description": "Boots the voice subsystem: discovers features, loads the router and listener, and wires up event forwarding.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "stop": {
      "description": "Tears down the voice subsystem: disables the listener, clears references, and resets state.",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "handleTriggerWord": {
      "description": "",
      "parameters": {
        "wakeword": {
          "type": "string",
          "description": "Parameter wakeword"
        }
      },
      "required": [
        "wakeword"
      ],
      "returns": "void"
    },
    "handleChiefCommand": {
      "description": "",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        }
      },
      "required": [
        "text"
      ],
      "returns": "void"
    },
    "askVoiceAssistant": {
      "description": "",
      "parameters": {
        "text": {
          "type": "string",
          "description": "Parameter text"
        }
      },
      "required": [
        "text"
      ],
      "returns": "Promise<string>"
    }
  },
  "getters": {
    "router": {
      "description": "Returns the VoiceRouter instance, or null if the service has not started.",
      "returns": "any"
    },
    "listener": {
      "description": "",
      "returns": "any"
    },
    "voiceAssistantChat": {
      "description": "",
      "returns": "any"
    },
    "chiefChat": {
      "description": "",
      "returns": "any"
    },
    "windowManager": {
      "description": "",
      "returns": "any"
    },
    "manifest": {
      "description": "Returns the router's command handler manifest, or an empty array if not started.",
      "returns": "any[]"
    }
  },
  "events": {
    "info": {
      "name": "info",
      "description": "Event emitted by VoiceService",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by VoiceService",
      "arguments": {}
    },
    "started": {
      "name": "started",
      "description": "Event emitted by VoiceService",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.taskScheduler', {
  "id": "features.taskScheduler",
  "description": "The TaskScheduler loads Task documents from the container's contentDb contentbase collection. It executes these tasks on a schedule. The TaskScheduler is designed to act as a system wide singleton, and establishes a process lock.",
  "shortcut": "features.taskScheduler",
  "className": "TaskScheduler",
  "methods": {
    "afterInitialize": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "isInProgress": {
      "description": "Check if a task is currently being executed",
      "parameters": {
        "taskId": {
          "type": "string",
          "description": "Parameter taskId"
        }
      },
      "required": [
        "taskId"
      ],
      "returns": "boolean"
    },
    "start": {
      "description": "Start the scheduler loop, loading tasks and beginning the tick interval",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "stop": {
      "description": "Stop the scheduler loop and clear the tick interval",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "loadTasks": {
      "description": "Load task entries from the contentDb Play and Task models, filtering untracked files and clearing stale running flags",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "loadTaskModel": {
      "description": "Load the contentbase document model for a specific task by ID",
      "parameters": {
        "taskId": {
          "type": "string",
          "description": "Parameter taskId"
        }
      },
      "required": [
        "taskId"
      ],
      "returns": "void"
    },
    "pause": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "unpause": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "resume": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "tick": {
      "description": "Run one scheduler cycle: reload docs, check due tasks, and execute any that are ready",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "isDue": {
      "description": "Check whether a task is due for execution based on its schedule and last run time",
      "parameters": {
        "task": {
          "type": "TaskEntry",
          "description": "Parameter task"
        }
      },
      "required": [
        "task"
      ],
      "returns": "boolean"
    },
    "scheduleToMs": {
      "description": "Convert a human-readable schedule string (e.g. 'hourly', 'daily', '4pm') to milliseconds",
      "parameters": {
        "schedule": {
          "type": "string",
          "description": "Parameter schedule"
        }
      },
      "required": [
        "schedule"
      ],
      "returns": "number"
    },
    "checkConditions": {
      "description": "Evaluate condition code blocks from the task document; returns false if any condition fails",
      "parameters": {
        "taskId": {
          "type": "string",
          "description": "Parameter taskId"
        }
      },
      "required": [
        "taskId"
      ],
      "returns": "Promise<boolean>"
    },
    "execute": {
      "description": "Execute a task by ID, managing in-progress state, condition checks, and document metadata updates",
      "parameters": {
        "taskId": {
          "type": "string",
          "description": "Parameter taskId"
        }
      },
      "required": [
        "taskId"
      ],
      "returns": "Promise<{ success: boolean; durationMs: number; skipped?: boolean }>"
    }
  },
  "getters": {
    "tasks": {
      "description": "All loaded task entries from state",
      "returns": "any"
    },
    "taskCount": {
      "description": "Total number of loaded tasks",
      "returns": "any"
    },
    "dueTasks": {
      "description": "Tasks that are due for execution and not currently in progress or running",
      "returns": "any"
    },
    "dueTaskCount": {
      "description": "Number of tasks currently due for execution",
      "returns": "any"
    },
    "dueOneOffTasks": {
      "description": "One-off tasks: repeatable=false, not yet completed (no lastRanAt), not in progress, not already running",
      "returns": "TaskEntry[]"
    },
    "dueScheduledTasks": {
      "description": "Scheduled tasks that are due: repeatable=true with schedule, elapsed > interval, not in progress, not already running",
      "returns": "TaskEntry[]"
    },
    "inProgressIds": {
      "description": "Get all currently in-progress task IDs",
      "returns": "string[]"
    },
    "isPaused": {
      "description": "",
      "returns": "any"
    },
    "isRunning": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {
    "started": {
      "name": "started",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "stopped": {
      "name": "stopped",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "taskRejected": {
      "name": "taskRejected",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "tasksLoaded": {
      "name": "tasksLoaded",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "tick": {
      "name": "tick",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "taskFailed": {
      "name": "taskFailed",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "conditionError": {
      "name": "conditionError",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "taskSkipped": {
      "name": "taskSkipped",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "taskStarted": {
      "name": "taskStarted",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    },
    "taskCompleted": {
      "name": "taskCompleted",
      "description": "Event emitted by TaskScheduler",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});
export const introspectionData = [
  {
    "id": "features.gws",
    "description": "Google Workspace CLI wrapper providing access to the full GWS API surface via subprocess. Supports profile-based credential management and typed sub-interfaces for Gmail, Sheets, Calendar, Drive, Docs, and Chat.",
    "shortcut": "features.gws",
    "className": "Gws",
    "methods": {
      "isAvailable": {
        "description": "Checks whether the GWS CLI binary can be resolved on this system.",
        "parameters": {},
        "required": [],
        "returns": "Promise<boolean>"
      },
      "version": {
        "description": "Returns the installed GWS CLI version string.",
        "parameters": {},
        "required": [],
        "returns": "Promise<string>"
      },
      "exec": {
        "description": "Executes an arbitrary GWS CLI command. Accepts path segments and an optional trailing options object.",
        "parameters": {
          "segments": {
            "type": "[...string[], GwsExecOptions] | string[]",
            "description": "Parameter segments"
          }
        },
        "required": [
          "segments"
        ],
        "returns": "Promise<any>"
      },
      "helper": {
        "description": "Executes a GWS CLI helper command (e.g. `gws gmail +send`). Helpers use --key value args instead of --params JSON.",
        "parameters": {
          "service": {
            "type": "string",
            "description": "Parameter service"
          },
          "helperName": {
            "type": "string",
            "description": "Parameter helperName"
          },
          "options": {
            "type": "GwsExecOptions",
            "description": "Parameter options",
            "properties": {
              "params": {
                "type": "Record<string, string | number | boolean>",
                "description": ""
              },
              "flags": {
                "type": "string[]",
                "description": ""
              },
              "json": {
                "type": "boolean",
                "description": ""
              },
              "ndjson": {
                "type": "boolean",
                "description": ""
              },
              "profile": {
                "type": "string",
                "description": ""
              }
            }
          }
        },
        "required": [
          "service",
          "helperName"
        ],
        "returns": "Promise<any>"
      },
      "useProfile": {
        "description": "Activates a named credential profile. Throws if the profile directory does not exist.",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          }
        },
        "required": [
          "name"
        ],
        "returns": "void"
      },
      "clearProfile": {
        "description": "Clears the active credential profile so subsequent commands use default credentials.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "useCredentials": {
        "description": "Points all subsequent commands at a specific credentials file path, bypassing the profile system.",
        "parameters": {
          "path": {
            "type": "string",
            "description": "Parameter path"
          }
        },
        "required": [
          "path"
        ],
        "returns": "void"
      },
      "profiles": {
        "description": "Lists all available credential profile names found in the profiles directory.",
        "parameters": {},
        "required": [],
        "returns": "string[]"
      }
    },
    "getters": {
      "currentProfile": {
        "description": "Returns the name of the currently active credential profile, or null if none is set.",
        "returns": "string | null"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.voiceRouter",
    "description": "Routes spoken voice commands to the appropriate handler or conversational assistant. Manages handler loading, phrase playback, workspace resolution, and conversation mode.",
    "shortcut": "features.voiceRouter",
    "className": "VoiceRouter",
    "methods": {
      "start": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "loadHandlers": {
        "description": "Scans the voice handlers directory, imports each handler module, and sorts by priority.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "loadPhraseManifest": {
        "description": "Loads phrase manifest from the voice-assistant and indexes entries by tag.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "randomPhrase": {
        "description": "Returns a random phrase file path for the given tag, avoiding repeats.",
        "parameters": {
          "tag": {
            "type": "string",
            "description": "Parameter tag"
          }
        },
        "required": [
          "tag"
        ],
        "returns": "string | null"
      },
      "playPhrase": {
        "description": "Plays a random audio phrase for the given tag using afplay.",
        "parameters": {
          "tag": {
            "type": "string",
            "description": "Parameter tag"
          }
        },
        "required": [
          "tag"
        ],
        "returns": "void"
      },
      "loadAssistantPhrases": {
        "description": "Loads phrase manifest from an assistant folder and indexes entries by tag.",
        "parameters": {
          "folder": {
            "type": "string",
            "description": "Parameter folder"
          }
        },
        "required": [
          "folder"
        ],
        "returns": "void"
      },
      "playAssistantPhrase": {
        "description": "Plays a random phrase from the loaded assistant manifest for the given tag.",
        "parameters": {
          "tag": {
            "type": "string",
            "description": "Parameter tag"
          }
        },
        "required": [
          "tag"
        ],
        "returns": "void"
      },
      "loadWorkspaceMap": {
        "description": "Build a map of all local packages and their voice-friendly aliases from the `luca.aliases` field in each package.json.",
        "parameters": {},
        "required": [],
        "returns": "Promise<WorkspaceEntry[]>"
      },
      "resolveWorkspace": {
        "description": "Resolve a spoken term to a workspace entry by matching against aliases. Returns null if no alias matches.",
        "parameters": {
          "term": {
            "type": "string",
            "description": "Parameter term"
          }
        },
        "required": [
          "term"
        ],
        "returns": "WorkspaceEntry | null"
      },
      "reloadHandlers": {
        "description": "Clears all loaded handlers and reloads them from disk.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "watchHandlers": {
        "description": "Watches the handlers directory for changes and auto-reloads when files are added, changed, or deleted.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "stopWatchingHandlers": {
        "description": "Stops watching the handlers directory.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "startPollingReload": {
        "description": "Polls for handler changes every 30 seconds so iterating during demos picks up new code.",
        "parameters": {
          "intervalMs": {
            "type": "any",
            "description": "Parameter intervalMs"
          }
        },
        "required": [],
        "returns": "void"
      },
      "stopPollingReload": {
        "description": "Stops the polling reload interval.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "route": {
        "description": "Routes a voice command to the first matching handler, or to the conversational assistant if in conversation mode.",
        "parameters": {
          "cmd": {
            "type": "CommandHandle",
            "description": "Parameter cmd"
          }
        },
        "required": [
          "cmd"
        ],
        "returns": "Promise<{ matched: boolean; ctx: HandlerContext; cmd: CommandHandle }>"
      },
      "inspect": {
        "description": "Dry-runs a voice command against all handlers and returns match diagnostics including parsed utterance and dictionary hits.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          }
        },
        "required": [
          "text"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "isRouting": {
        "description": "",
        "returns": "boolean"
      },
      "workspaceMap": {
        "description": "Returns the loaded workspace entries with their voice-friendly aliases.",
        "returns": "WorkspaceEntry[]"
      },
      "handlerFiles": {
        "description": "Returns the list of loaded handler names and their source file paths.",
        "returns": "Array<{ name: string; file: string }>"
      },
      "manifest": {
        "description": "Returns a manifest of all loaded handlers with their name, description, keywords, and priority.",
        "returns": "Array<{ name: string; description: string; keywords: string[]; priority: number }>"
      },
      "phraseTags": {
        "description": "",
        "returns": "string[]"
      }
    },
    "events": {
      "handlerFinished": {
        "name": "handlerFinished",
        "description": "Event emitted by VoiceRouter",
        "arguments": {}
      },
      "handlerError": {
        "name": "handlerError",
        "description": "Event emitted by VoiceRouter",
        "arguments": {}
      },
      "routeFinished": {
        "name": "routeFinished",
        "description": "Event emitted by VoiceRouter",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.voiceChat",
    "description": "Standalone conversational voice chat feature. Wraps an Assistant + SpeechStreamer pair for streaming TTS conversations. Can be instantiated with any assistant folder, voice, and settings.",
    "shortcut": "features.voiceChat",
    "className": "VoiceChat",
    "methods": {
      "start": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "mute": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "unmute": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "wireUpResponseEvents": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "readVoiceConfig": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "checkCapabilities": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<CapabilityResult>"
      },
      "speakPhrase": {
        "description": "",
        "parameters": {
          "phrase": {
            "type": "string",
            "description": "Parameter phrase"
          }
        },
        "required": [
          "phrase"
        ],
        "returns": "void"
      },
      "createSpeechStreamer": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "loadPhraseManifest": {
        "description": "Loads the phrase manifest JSON from the assistant's generated folder and indexes by tag.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "randomPhrase": {
        "description": "Returns a random phrase file path for the given tag, avoiding repeats.",
        "parameters": {
          "tag": {
            "type": "string",
            "description": "Parameter tag"
          }
        },
        "required": [
          "tag"
        ],
        "returns": "string | null"
      },
      "playPhrase": {
        "description": "Plays a random audio phrase for the given tag using afplay.",
        "parameters": {
          "tag": {
            "type": "string",
            "description": "Parameter tag"
          }
        },
        "required": [
          "tag"
        ],
        "returns": "void"
      },
      "say": {
        "description": "Send a message to the assistant and stream the response as speech. Returns the full text response.",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<string>"
      },
      "ask": {
        "description": "Ask the assistant a question. Alias for say().",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<string>"
      },
      "playToolcallPhrase": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "playToolResultPhrase": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "playToolErrorPhrase": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "assistantsManager": {
        "description": "",
        "returns": "AssistantsManager"
      },
      "assistant": {
        "description": "",
        "returns": "Assistant"
      },
      "isMuted": {
        "description": "",
        "returns": "boolean"
      },
      "isStarted": {
        "description": "",
        "returns": "boolean"
      },
      "isConversing": {
        "description": "Whether the chat is currently in conversation mode.",
        "returns": "boolean"
      },
      "voiceConfig": {
        "description": "",
        "returns": "VoiceConfig"
      }
    },
    "events": {
      "info": {
        "name": "info",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      },
      "started": {
        "name": "started",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      },
      "debug": {
        "name": "debug",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      },
      "toolCall": {
        "name": "toolCall",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      },
      "toolResult": {
        "name": "toolResult",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      },
      "toolError": {
        "name": "toolError",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      },
      "finished": {
        "name": "finished",
        "description": "Event emitted by VoiceChat",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.imsg",
    "description": "Wrapper around the imsg CLI for iMessage. Provides programmatic access to list chats, read history, send messages, react, and watch for incoming messages.",
    "shortcut": "features.imsg",
    "className": "Imsg",
    "methods": {
      "chats": {
        "description": "List recent conversations",
        "parameters": {
          "opts": {
            "type": "{ limit?: number }",
            "description": "Parameter opts"
          }
        },
        "required": [],
        "returns": "Promise<Chat[]>"
      },
      "history": {
        "description": "Get message history for a chat",
        "parameters": {
          "chatId": {
            "type": "number",
            "description": "Parameter chatId"
          },
          "opts": {
            "type": "HistoryOptions",
            "description": "Parameter opts",
            "properties": {
              "limit": {
                "type": "number",
                "description": ""
              },
              "participants": {
                "type": "string",
                "description": ""
              },
              "start": {
                "type": "string",
                "description": ""
              },
              "end": {
                "type": "string",
                "description": ""
              },
              "attachments": {
                "type": "boolean",
                "description": ""
              }
            }
          }
        },
        "required": [
          "chatId"
        ],
        "returns": "Promise<Message[]>"
      },
      "send": {
        "description": "Send a text message to a phone number/email or chat ID",
        "parameters": {
          "to": {
            "type": "string",
            "description": "Parameter to"
          },
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "opts": {
            "type": "{ file?: string; service?: string; chatId?: number }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "to",
          "text"
        ],
        "returns": "Promise<SendResult>"
      },
      "react": {
        "description": "Send a tapback reaction to the most recent message in a chat",
        "parameters": {
          "chatId": {
            "type": "number",
            "description": "Parameter chatId"
          },
          "reaction": {
            "type": "string",
            "description": "Parameter reaction"
          }
        },
        "required": [
          "chatId",
          "reaction"
        ],
        "returns": "Promise<SendResult>"
      },
      "watch": {
        "description": "Watch for incoming messages. Returns an abort function to stop watching.",
        "parameters": {
          "opts": {
            "type": "WatchOptions",
            "description": "Parameter opts",
            "properties": {
              "chatId": {
                "type": "number",
                "description": ""
              },
              "participants": {
                "type": "string",
                "description": ""
              },
              "sinceRowid": {
                "type": "number",
                "description": ""
              },
              "attachments": {
                "type": "boolean",
                "description": ""
              },
              "reactions": {
                "type": "boolean",
                "description": ""
              },
              "debounce": {
                "type": "string",
                "description": ""
              },
              "onMessage": {
                "type": "(msg: Message) => void",
                "description": ""
              },
              "onError": {
                "type": "(err: string) => void",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<{ stop: () => void }>"
      }
    },
    "getters": {},
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const imsg = container.feature('imsg')\nconst chats = await imsg.chats({ limit: 5 })\nconst messages = await imsg.history(6, { limit: 10 })\nawait imsg.send('+15551234567', 'Hello from luca')"
      }
    ]
  },
  {
    "id": "features.projectBuilder",
    "description": "ProjectBuilder Feature Loads contentbase projects and their plans, executes them sequentially via Claude Code sessions, caches results, writes build reports, and persists plan completion status back to the markdown files. Supports cross-process operation via IPC: - **server** mode: runs the build, broadcasts events, handles requests - **client** mode: proxies commands to the server, relays events locally - **standalone** mode: operates independently (default) Auto-detection: on creation, probes `tmp/project-builder.sock` — if reachable, enters client mode; otherwise standalone (promotable to server). Events: build:loaded   - Project and plans loaded from contentbase build:start    - Build execution starting build:complete - All plans finished successfully build:error    - A plan failed, stopping the build build:aborting - Abort requested, killing active session build:aborted  - Build was manually aborted plan:skipped   - Plan was already completed, skipping plan:queued    - Plan is next in the execution queue plan:start     - Plan execution started (Claude Code session spawned) plan:delta     - Streaming text delta from the plan's Claude session plan:message   - Full message from the plan's Claude session plan:complete  - Plan finished successfully plan:error     - Plan execution failed",
    "shortcut": "features.projectBuilder",
    "className": "ProjectBuilder",
    "methods": {
      "whenReady": {
        "description": "Returns a promise that resolves when auto-detection and initial hydration (client connect or disk snapshot load) is complete.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "afterInitialize": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "emit": {
        "description": "",
        "parameters": {
          "event": {
            "type": "string",
            "description": "Parameter event"
          },
          "args": {
            "type": "any[]",
            "description": "Parameter args"
          }
        },
        "required": [
          "event",
          "args"
        ],
        "returns": "void"
      },
      "startServer": {
        "description": "Start the IPC server. Listens on the socket path and accepts client connections. Should be called from the authoritative process (e.g. `luca project-builder`).",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "stopServer": {
        "description": "Stop the IPC server and clean up the socket file.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "sendRequest": {
        "description": "Send a request to the IPC server and wait for the correlated response.",
        "parameters": {
          "method": {
            "type": "string",
            "description": "Parameter method"
          },
          "args": {
            "type": "any",
            "description": "Parameter args"
          }
        },
        "required": [
          "method"
        ],
        "returns": "Promise<any>"
      },
      "load": {
        "description": "Load the project and its plans from contentbase. Discovers the execution order, resolves plan documents, and restores cached data for previously completed plans. In client mode, proxies the request to the server.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "run": {
        "description": "Execute all pending plans sequentially via Claude Code sessions. Already-completed plans are skipped. Emits events for each lifecycle stage. Stops on the first plan error. In client mode, proxies the request to the server.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "abort": {
        "description": "Abort the current build execution. Kills the active Claude Code session and resets build status to ready. In client mode, proxies the request to the server.",
        "parameters": {},
        "required": [],
        "returns": "Promise<void>"
      },
      "startWatcher": {
        "description": "Start polling for approved projects. Each approved project gets a ProjectBuilder instance that loads and runs its plans. Completed or already-in-progress projects are skipped.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "stopWatcher": {
        "description": "Stop the watcher. Does not abort in-progress builds.",
        "parameters": {},
        "required": [],
        "returns": "this"
      }
    },
    "getters": {
      "buildStatus": {
        "description": "Current build status.",
        "returns": "BuildStatus"
      },
      "currentPlanId": {
        "description": "ID of the plan currently being executed.",
        "returns": "string | null"
      },
      "isLoaded": {
        "description": "Whether the project has been loaded.",
        "returns": "boolean"
      },
      "isIdle": {
        "description": "Whether the builder is idle (not actively running a build).",
        "returns": "boolean"
      },
      "isClient": {
        "description": "Whether this instance is operating as an IPC client.",
        "returns": "boolean"
      },
      "isServer": {
        "description": "Whether this instance is operating as an IPC server.",
        "returns": "boolean"
      },
      "resolvedSocketPath": {
        "description": "Resolved absolute path for the IPC socket.",
        "returns": "string"
      },
      "buildsInProgress": {
        "description": "Currently building project slugs.",
        "returns": "string[]"
      }
    },
    "events": {
      "build:loaded": {
        "name": "build:loaded",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:skipped": {
        "name": "plan:skipped",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "build:start": {
        "name": "build:start",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "build:complete": {
        "name": "build:complete",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:delta": {
        "name": "plan:delta",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:message": {
        "name": "plan:message",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:queued": {
        "name": "plan:queued",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:start": {
        "name": "plan:start",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:error": {
        "name": "plan:error",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "build:error": {
        "name": "build:error",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "plan:complete": {
        "name": "plan:complete",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "build:aborting": {
        "name": "build:aborting",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "build:aborted": {
        "name": "build:aborted",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:started": {
        "name": "watcher:started",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:stopped": {
        "name": "watcher:stopped",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:building": {
        "name": "watcher:building",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:error": {
        "name": "watcher:error",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:build:error": {
        "name": "watcher:build:error",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:build:skipped": {
        "name": "watcher:build:skipped",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      },
      "watcher:build:start": {
        "name": "watcher:build:start",
        "description": "Event emitted by ProjectBuilder",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.voiceListener",
    "description": "WhisperMLX server side based listener",
    "shortcut": "features.voiceListener",
    "className": "VoiceListener",
    "methods": {
      "lock": {
        "description": "Lock the listener, preventing it from reacting to wakewords until it is unlocked",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "unlock": {
        "description": "Unlock the listener, allowing it to react to wakewords",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "checkCapabilities": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "Promise<CapabilityResult>"
      },
      "stopWaitingForTriggerWord": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "react": {
        "description": "",
        "parameters": {
          "wakeword": {
            "type": "string",
            "description": "Parameter wakeword"
          }
        },
        "required": [
          "wakeword"
        ],
        "returns": "void"
      },
      "waitForTriggerWord": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "listen": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ silenceTimeout?: number }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<string>"
      }
    },
    "getters": {
      "isLocked": {
        "description": "",
        "returns": "any"
      },
      "currentInputVolume": {
        "description": "Get the current input volume",
        "returns": "number"
      },
      "modelsDir": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {
      "locked": {
        "name": "locked",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "unlocked": {
        "name": "unlocked",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "triggerWord": {
        "name": "triggerWord",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "triggerWordErrorOutput": {
        "name": "triggerWordErrorOutput",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "info": {
        "name": "info",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "skippedTriggerWord": {
        "name": "skippedTriggerWord",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "vu": {
        "name": "vu",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "output": {
        "name": "output",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "recording:start": {
        "name": "recording:start",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "recording:stop": {
        "name": "recording:stop",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      },
      "preview": {
        "name": "preview",
        "description": "Event emitted by VoiceListener",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const voiceListener = container.feature('voiceListener')"
      }
    ]
  },
  {
    "id": "features.voiceService",
    "description": "Orchestrates the voice subsystem: VoiceRouter, launcher listener, and window manager.",
    "shortcut": "features.voiceService",
    "className": "VoiceService",
    "methods": {
      "start": {
        "description": "Boots the voice subsystem: discovers features, loads the router and listener, and wires up event forwarding.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "stop": {
        "description": "Tears down the voice subsystem: disables the listener, clears references, and resets state.",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "handleTriggerWord": {
        "description": "",
        "parameters": {
          "wakeword": {
            "type": "string",
            "description": "Parameter wakeword"
          }
        },
        "required": [
          "wakeword"
        ],
        "returns": "void"
      },
      "handleChiefCommand": {
        "description": "",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          }
        },
        "required": [
          "text"
        ],
        "returns": "void"
      },
      "askVoiceAssistant": {
        "description": "",
        "parameters": {
          "text": {
            "type": "string",
            "description": "Parameter text"
          }
        },
        "required": [
          "text"
        ],
        "returns": "Promise<string>"
      }
    },
    "getters": {
      "router": {
        "description": "Returns the VoiceRouter instance, or null if the service has not started.",
        "returns": "any"
      },
      "listener": {
        "description": "",
        "returns": "any"
      },
      "voiceAssistantChat": {
        "description": "",
        "returns": "any"
      },
      "chiefChat": {
        "description": "",
        "returns": "any"
      },
      "windowManager": {
        "description": "",
        "returns": "any"
      },
      "manifest": {
        "description": "Returns the router's command handler manifest, or an empty array if not started.",
        "returns": "any[]"
      }
    },
    "events": {
      "info": {
        "name": "info",
        "description": "Event emitted by VoiceService",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by VoiceService",
        "arguments": {}
      },
      "started": {
        "name": "started",
        "description": "Event emitted by VoiceService",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.taskScheduler",
    "description": "The TaskScheduler loads Task documents from the container's contentDb contentbase collection. It executes these tasks on a schedule. The TaskScheduler is designed to act as a system wide singleton, and establishes a process lock.",
    "shortcut": "features.taskScheduler",
    "className": "TaskScheduler",
    "methods": {
      "afterInitialize": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "isInProgress": {
        "description": "Check if a task is currently being executed",
        "parameters": {
          "taskId": {
            "type": "string",
            "description": "Parameter taskId"
          }
        },
        "required": [
          "taskId"
        ],
        "returns": "boolean"
      },
      "start": {
        "description": "Start the scheduler loop, loading tasks and beginning the tick interval",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "stop": {
        "description": "Stop the scheduler loop and clear the tick interval",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "loadTasks": {
        "description": "Load task entries from the contentDb Play and Task models, filtering untracked files and clearing stale running flags",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "loadTaskModel": {
        "description": "Load the contentbase document model for a specific task by ID",
        "parameters": {
          "taskId": {
            "type": "string",
            "description": "Parameter taskId"
          }
        },
        "required": [
          "taskId"
        ],
        "returns": "void"
      },
      "pause": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "unpause": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "resume": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "tick": {
        "description": "Run one scheduler cycle: reload docs, check due tasks, and execute any that are ready",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "isDue": {
        "description": "Check whether a task is due for execution based on its schedule and last run time",
        "parameters": {
          "task": {
            "type": "TaskEntry",
            "description": "Parameter task"
          }
        },
        "required": [
          "task"
        ],
        "returns": "boolean"
      },
      "scheduleToMs": {
        "description": "Convert a human-readable schedule string (e.g. 'hourly', 'daily', '4pm') to milliseconds",
        "parameters": {
          "schedule": {
            "type": "string",
            "description": "Parameter schedule"
          }
        },
        "required": [
          "schedule"
        ],
        "returns": "number"
      },
      "checkConditions": {
        "description": "Evaluate condition code blocks from the task document; returns false if any condition fails",
        "parameters": {
          "taskId": {
            "type": "string",
            "description": "Parameter taskId"
          }
        },
        "required": [
          "taskId"
        ],
        "returns": "Promise<boolean>"
      },
      "execute": {
        "description": "Execute a task by ID, managing in-progress state, condition checks, and document metadata updates",
        "parameters": {
          "taskId": {
            "type": "string",
            "description": "Parameter taskId"
          }
        },
        "required": [
          "taskId"
        ],
        "returns": "Promise<{ success: boolean; durationMs: number; skipped?: boolean }>"
      }
    },
    "getters": {
      "tasks": {
        "description": "All loaded task entries from state",
        "returns": "any"
      },
      "taskCount": {
        "description": "Total number of loaded tasks",
        "returns": "any"
      },
      "dueTasks": {
        "description": "Tasks that are due for execution and not currently in progress or running",
        "returns": "any"
      },
      "dueTaskCount": {
        "description": "Number of tasks currently due for execution",
        "returns": "any"
      },
      "dueOneOffTasks": {
        "description": "One-off tasks: repeatable=false, not yet completed (no lastRanAt), not in progress, not already running",
        "returns": "TaskEntry[]"
      },
      "dueScheduledTasks": {
        "description": "Scheduled tasks that are due: repeatable=true with schedule, elapsed > interval, not in progress, not already running",
        "returns": "TaskEntry[]"
      },
      "inProgressIds": {
        "description": "Get all currently in-progress task IDs",
        "returns": "string[]"
      },
      "isPaused": {
        "description": "",
        "returns": "any"
      },
      "isRunning": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {
      "started": {
        "name": "started",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "stopped": {
        "name": "stopped",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "taskRejected": {
        "name": "taskRejected",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "tasksLoaded": {
        "name": "tasksLoaded",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "tick": {
        "name": "tick",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "taskFailed": {
        "name": "taskFailed",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "conditionError": {
        "name": "conditionError",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "taskSkipped": {
        "name": "taskSkipped",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "taskStarted": {
        "name": "taskStarted",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      },
      "taskCompleted": {
        "name": "taskCompleted",
        "description": "Event emitted by TaskScheduler",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  }
];
