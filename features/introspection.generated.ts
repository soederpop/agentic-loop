import { setBuildTimeData } from '@soederpop/luca/introspection';

// Auto-generated introspection registry data
// Generated at: 2026-04-02T05:23:32.394Z

setBuildTimeData('features.chatService', {
  "id": "features.chatService",
  "description": "Reusable real-time chat service. Manages WebSocket connections, assistant sessions, and the streaming protocol (init → user_message → chunks/tool events → complete). Usage: const chatService = container.feature('chatService', { threadPrefix: 'my-workflow' }) chatService.attach(httpServer)",
  "shortcut": "features.chatService",
  "className": "ChatService",
  "methods": {
    "setVoiceChat": {
      "description": "Attach a VoiceChat instance for voice responses. When set, the service can route messages through voice based on voiceMode.",
      "parameters": {
        "voiceChat": {
          "type": "VoiceChat",
          "description": "Parameter voiceChat"
        }
      },
      "required": [
        "voiceChat"
      ],
      "returns": "void"
    },
    "setVoiceMode": {
      "description": "",
      "parameters": {
        "mode": {
          "type": "VoiceMode",
          "description": "Parameter mode"
        }
      },
      "required": [
        "mode"
      ],
      "returns": "void"
    },
    "onMessage": {
      "description": "Register a handler for custom message types (e.g. 'start_review'). Called for any message that isn't 'init' or 'user_message'.",
      "parameters": {
        "handler": {
          "type": "CustomMessageHandler",
          "description": "Parameter handler"
        }
      },
      "required": [
        "handler"
      ],
      "returns": "void"
    },
    "attach": {
      "description": "Attach a WebSocket server to an existing HTTP server. Call this after your express/HTTP server is listening.",
      "parameters": {
        "httpServer": {
          "type": "HttpServer",
          "description": "Parameter httpServer"
        }
      },
      "required": [
        "httpServer"
      ],
      "returns": "WebSocketServer"
    },
    "listen": {
      "description": "Create a standalone WebSocket server on a given port.",
      "parameters": {
        "port": {
          "type": "number",
          "description": "Parameter port"
        },
        "host": {
          "type": "any",
          "description": "Parameter host"
        }
      },
      "required": [
        "port"
      ],
      "returns": "WebSocketServer"
    },
    "resolveAssistantName": {
      "description": "Resolve a short assistant name to its full registered name.",
      "parameters": {
        "shortName": {
          "type": "string",
          "description": "Parameter shortName"
        }
      },
      "required": [
        "shortName"
      ],
      "returns": "string | null"
    },
    "listAssistants": {
      "description": "List available assistants as { id, name } pairs.",
      "parameters": {},
      "required": [],
      "returns": "Array<{ id: string; name: string }>"
    },
    "getOrCreateSession": {
      "description": "Get or create a session for the given sessionId + assistantId combo. When a voiceChat is attached, its assistant is used as the session assistant.",
      "parameters": {
        "sessionId": {
          "type": "string",
          "description": "Parameter sessionId"
        },
        "assistantId": {
          "type": "string",
          "description": "Parameter assistantId"
        }
      },
      "required": [
        "sessionId",
        "assistantId"
      ],
      "returns": "Promise<ChatSession | null>"
    },
    "streamResponse": {
      "description": "Send a message to an assistant and stream the response over a WebSocket. Can be used directly without WebSocket by passing event callbacks instead.",
      "parameters": {
        "session": {
          "type": "ChatSession",
          "description": "Parameter session",
          "properties": {
            "assistant": {
              "type": "Assistant",
              "description": ""
            },
            "assistantId": {
              "type": "string",
              "description": ""
            },
            "sessionKey": {
              "type": "string",
              "description": ""
            }
          }
        },
        "text": {
          "type": "string",
          "description": "Parameter text"
        },
        "callbacks": {
          "type": "{\n\t\t\tonStart: (messageId: string) => void\n\t\t\tonChunk: (messageId: string, textDelta: string) => void\n\t\t\tonToolStart: (id: string, name: string, startedAt: number) => void\n\t\t\tonToolEnd: (id: string, name: string, ok: boolean, endedAt: number, durationMs: number, detail?: string) => void\n\t\t\tonComplete: (messageId: string, text: string) => void\n\t\t\tonError: (message: string) => void\n\t\t}",
          "description": "Parameter callbacks"
        }
      },
      "required": [
        "session",
        "text",
        "callbacks"
      ],
      "returns": "Promise<string>"
    },
    "shutdown": {
      "description": "Close all sessions and the WebSocket server.",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "voiceChat": {
      "description": "",
      "returns": "VoiceChat | null"
    },
    "voiceMode": {
      "description": "",
      "returns": "VoiceMode"
    },
    "assistantsManager": {
      "description": "",
      "returns": "AssistantsManager"
    }
  },
  "events": {
    "voiceModeChanged": {
      "name": "voiceModeChanged",
      "description": "Event emitted by ChatService",
      "arguments": {}
    },
    "attached": {
      "name": "attached",
      "description": "Event emitted by ChatService",
      "arguments": {}
    },
    "listening": {
      "name": "listening",
      "description": "Event emitted by ChatService",
      "arguments": {}
    },
    "sessionCreated": {
      "name": "sessionCreated",
      "description": "Event emitted by ChatService",
      "arguments": {}
    },
    "shutdown": {
      "name": "shutdown",
      "description": "Event emitted by ChatService",
      "arguments": {}
    },
    "connection": {
      "name": "connection",
      "description": "Event emitted by ChatService",
      "arguments": {}
    },
    "disconnection": {
      "name": "disconnection",
      "description": "Event emitted by ChatService",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "types": {
    "ChatSession": {
      "description": "── Session ──",
      "properties": {
        "assistant": {
          "type": "Assistant",
          "description": ""
        },
        "assistantId": {
          "type": "string",
          "description": ""
        },
        "sessionKey": {
          "type": "string",
          "description": ""
        }
      }
    }
  }
});

setBuildTimeData('features.gws', {
  "id": "features.gws",
  "description": "Google Workspace CLI wrapper providing access to the full GWS API surface via subprocess. Supports profile-based credential management and typed sub-interfaces for Gmail, Sheets, Calendar, Drive, Docs, and Chat.",
  "shortcut": "features.gws",
  "className": "Gws",
  "methods": {
    "configDirForProfile": {
      "description": "Returns the config directory for a given profile. No profile uses ~/.config/gws, named profiles use ~/.config/gws-<name>.",
      "parameters": {
        "profile": {
          "type": "string | null",
          "description": "Parameter profile"
        }
      },
      "required": [],
      "returns": "string"
    },
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
      "description": "Activates a named credential profile. Throws if ~/.config/gws-<name> does not exist.",
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
      "description": "Lists all available credential profile names by scanning for ~/.config/gws-* directories.",
      "parameters": {},
      "required": [],
      "returns": "string[]"
    },
    "gwsListProfiles": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "gwsSendEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ to: string; subject: string; body: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsSearchEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ query: string; maxResults?: number; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsReadEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ id: string; markAsRead?: boolean; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsTriageEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ max?: number; query?: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsTrashEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ id: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsArchiveEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ id: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsValidateEmail": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ id: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsGetCalendarAgenda": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ days?: number; calendar?: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsCreateCalendarEvent": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{\n    summary: string; start: string; end?: string; duration?: number;\n    calendar?: string; location?: string; description?: string;\n    attendees?: string[]; profile?: string\n  }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsReadSpreadsheet": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ spreadsheet: string; range: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsAppendToSpreadsheet": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ spreadsheet: string; values?: string; jsonValues?: string[][]; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsSearchDrive": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ query: string; pageSize?: number; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsSendChatMessage": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ space: string; text: string; profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "gwsCheckAuth": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ profile?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "configDir": {
      "description": "",
      "returns": "string"
    },
    "currentProfile": {
      "description": "Returns the name of the currently active credential profile, or null if none is set.",
      "returns": "string | null"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "types": {
    "GwsExecOptions": {
      "description": "Interfaces",
      "properties": {
        "params": {
          "type": "Record<string, string | number | boolean>",
          "description": "",
          "optional": true
        },
        "flags": {
          "type": "string[]",
          "description": "",
          "optional": true
        },
        "json": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "ndjson": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "profile": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.windowManager', {
  "id": "features.windowManager",
  "description": "WindowManager Feature — Native window control via LucaVoiceLauncher Uses a broker/producer architecture so multiple luca processes can trigger window operations without competing for the same Unix socket. **Architecture:** - The first process to call `listen()` becomes the **broker**. It owns the app-facing socket (`ipc-window.sock`) and a control socket (`ipc-window-control.sock`). - Subsequent processes detect the broker and become **producers**. They connect to the control socket and route commands through the broker. - The broker forwards producer commands to the native app and routes acks and lifecycle events back to the originating producer. **Protocol:** - Bun listens on a Unix domain socket; the native app connects as a client - Window dispatch commands are sent as NDJSON with a `window` field - The app executes window commands and sends back `windowAck` messages - Any non-windowAck message from the app is emitted as a `message` event - Other features can use `send()` to write arbitrary NDJSON to the app **Capabilities:** - Spawn native browser windows with configurable chrome - Navigate, focus, close, and eval JavaScript in windows - Multiple luca processes can trigger window operations simultaneously - Automatic broker detection and producer fallback Observable state includes `windows` (open window metadata), `pendingOperations` (in-flight command ids), and `producerCount` (broker). Sockets, promises, and `WindowHandle` instances stay internal. **Producer state:** The broker pushes `windowStateSync` on the control socket when a producer connects and whenever the window roster changes, so every process sees the same `windows` / `windowCount` / `clientConnected` as the broker (not only its own acks).",
  "shortcut": "features.windowManager",
  "className": "WindowManager",
  "methods": {
    "enable": {
      "description": "",
      "parameters": {
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "listen": {
      "description": "Start the window manager. Automatically detects whether a broker already exists and either becomes the broker or connects as a producer. - If no broker is running: becomes the broker, binds the app socket and a control socket for producers. - If a broker is already running: connects as a producer through the control socket.",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Override the configured app socket path"
        }
      },
      "required": [],
      "returns": "Promise<this>"
    },
    "cleanupSocket": {
      "description": "Remove stale socket files without starting or stopping the server. Useful when a previous process crashed and left dead sockets behind. Will not remove sockets that have live listeners.",
      "parameters": {
        "socketPath": {
          "type": "string",
          "description": "Override the configured socket path"
        }
      },
      "required": [],
      "returns": "Promise<boolean>"
    },
    "stop": {
      "description": "Stop the window manager and clean up all connections. Rejects any pending window operation requests.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "spawn": {
      "description": "Spawn a new native browser window. Sends a window dispatch to the app and waits for the ack.",
      "parameters": {
        "opts": {
          "type": "SpawnOptions",
          "description": "Window configuration (url, dimensions, chrome options)",
          "properties": {
            "url": {
              "type": "string",
              "description": ""
            },
            "width": {
              "type": "DimensionValue",
              "description": ""
            },
            "height": {
              "type": "DimensionValue",
              "description": ""
            },
            "x": {
              "type": "DimensionValue",
              "description": ""
            },
            "y": {
              "type": "DimensionValue",
              "description": ""
            },
            "alwaysOnTop": {
              "type": "boolean",
              "description": ""
            },
            "window": {
              "type": "{\n    decorations?: 'normal' | 'hiddenTitleBar' | 'none'\n    transparent?: boolean\n    shadow?: boolean\n    alwaysOnTop?: boolean\n    opacity?: number\n    clickThrough?: boolean\n  }",
              "description": ""
            }
          }
        }
      },
      "required": [],
      "returns": "Promise<WindowHandle>"
    },
    "spawnTTY": {
      "description": "Spawn a native terminal window running a command. The terminal is read-only — stdout/stderr are rendered with ANSI support. Closing the window terminates the process.",
      "parameters": {
        "opts": {
          "type": "SpawnTTYOptions",
          "description": "Terminal configuration (command, args, cwd, dimensions, etc.)",
          "properties": {
            "command": {
              "type": "string",
              "description": "Executable name or path (required)."
            },
            "args": {
              "type": "string[]",
              "description": "Arguments passed after the command."
            },
            "cwd": {
              "type": "string",
              "description": "Working directory for the process."
            },
            "env": {
              "type": "Record<string, string>",
              "description": "Environment variable overrides."
            },
            "cols": {
              "type": "number",
              "description": "Initial terminal columns."
            },
            "rows": {
              "type": "number",
              "description": "Initial terminal rows."
            },
            "title": {
              "type": "string",
              "description": "Window title."
            },
            "width": {
              "type": "DimensionValue",
              "description": "Window width in points."
            },
            "height": {
              "type": "DimensionValue",
              "description": "Window height in points."
            },
            "x": {
              "type": "DimensionValue",
              "description": "Window x position."
            },
            "y": {
              "type": "DimensionValue",
              "description": "Window y position."
            },
            "window": {
              "type": "SpawnOptions['window']",
              "description": "Chrome options (decorations, alwaysOnTop, etc.)"
            }
          }
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<WindowHandle>"
    },
    "focus": {
      "description": "Bring a window to the front.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID. If omitted, the app uses the most recent window."
        }
      },
      "required": [],
      "returns": "Promise<WindowAckResult>"
    },
    "close": {
      "description": "Close a window.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID. If omitted, the app closes the most recent window."
        }
      },
      "required": [],
      "returns": "Promise<WindowAckResult>"
    },
    "navigate": {
      "description": "Navigate a window to a new URL.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "url": {
          "type": "string",
          "description": "The URL to navigate to"
        }
      },
      "required": [
        "windowId",
        "url"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "eval": {
      "description": "Evaluate JavaScript in a window's web view.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "code": {
          "type": "string",
          "description": "JavaScript code to evaluate"
        },
        "opts": {
          "type": "{ timeoutMs?: number; returnJson?: boolean }",
          "description": "timeoutMs (default 5000), returnJson (default true)"
        }
      },
      "required": [
        "windowId",
        "code"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "screengrab": {
      "description": "Capture a PNG screenshot from a window.",
      "parameters": {
        "opts": {
          "type": "WindowScreenGrabOptions",
          "description": "Window target and output path",
          "properties": {
            "windowId": {
              "type": "string",
              "description": "Window ID. If omitted, the launcher uses the most recent window."
            },
            "path": {
              "type": "string",
              "description": "Output file path for the PNG image."
            }
          }
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "video": {
      "description": "Record a video from a window to disk.",
      "parameters": {
        "opts": {
          "type": "WindowVideoOptions",
          "description": "Window target, output path, and optional duration",
          "properties": {
            "windowId": {
              "type": "string",
              "description": "Window ID. If omitted, the launcher uses the most recent window."
            },
            "path": {
              "type": "string",
              "description": "Output file path for the video file."
            },
            "durationMs": {
              "type": "number",
              "description": "Recording duration in milliseconds."
            }
          }
        }
      },
      "required": [
        "opts"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "move": {
      "description": "Move a window to a new position.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "x": {
          "type": "DimensionValue",
          "description": "New x position (absolute points or percentage string like \"25%\")"
        },
        "y": {
          "type": "DimensionValue",
          "description": "New y position (absolute points or percentage string like \"10%\")"
        }
      },
      "required": [
        "windowId",
        "x",
        "y"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "resize": {
      "description": "Resize a window.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "width": {
          "type": "DimensionValue",
          "description": "New width (absolute points or percentage string like \"50%\")"
        },
        "height": {
          "type": "DimensionValue",
          "description": "New height (absolute points or percentage string like \"70%\")"
        }
      },
      "required": [
        "windowId",
        "width",
        "height"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "setFrame": {
      "description": "Set a window's full frame (position and/or size).",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        },
        "frame": {
          "type": "{ x?: DimensionValue; y?: DimensionValue; width?: DimensionValue; height?: DimensionValue }",
          "description": "Object with x, y, width, height (all optional, supports percentage strings)"
        }
      },
      "required": [
        "windowId",
        "frame"
      ],
      "returns": "Promise<WindowAckResult>"
    },
    "window": {
      "description": "Get a WindowHandle for chainable operations on a specific window. Returns the tracked handle if one exists, otherwise creates a new one.",
      "parameters": {
        "windowId": {
          "type": "string",
          "description": "The window ID"
        }
      },
      "required": [
        "windowId"
      ],
      "returns": "WindowHandle"
    },
    "spawnLayout": {
      "description": "Spawn multiple windows in parallel from a layout configuration. Returns handles in the same order as the config entries.",
      "parameters": {
        "config": {
          "type": "LayoutEntry[]",
          "description": "Array of layout entries (window or tty)"
        }
      },
      "required": [
        "config"
      ],
      "returns": "Promise<WindowHandle[]>",
      "examples": [
        {
          "language": "ts",
          "code": "const handles = await wm.spawnLayout([\n { type: 'window', url: 'https://google.com', width: 800, height: 600 },\n { type: 'tty', command: 'htop' },\n { url: 'https://github.com' }, // defaults to window\n])"
        }
      ]
    },
    "spawnLayouts": {
      "description": "Spawn multiple layouts sequentially. Each layout's windows spawn in parallel, but the next layout waits for the previous one to fully complete.",
      "parameters": {
        "configs": {
          "type": "LayoutEntry[][]",
          "description": "Array of layout configurations"
        }
      },
      "required": [
        "configs"
      ],
      "returns": "Promise<WindowHandle[][]>",
      "examples": [
        {
          "language": "ts",
          "code": "const [firstBatch, secondBatch] = await wm.spawnLayouts([\n [{ url: 'https://google.com' }, { url: 'https://github.com' }],\n [{ type: 'tty', command: 'htop' }],\n])"
        }
      ]
    },
    "send": {
      "description": "Write an NDJSON message to the connected app client. In producer mode, routes through the broker. Public so other features can send arbitrary protocol messages over the same socket.",
      "parameters": {
        "msg": {
          "type": "Record<string, any>",
          "description": "The message object to send (will be JSON-serialized + newline)"
        }
      },
      "required": [
        "msg"
      ],
      "returns": "boolean"
    },
    "wmListWindows": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "wmSpawnBrowser": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ url?: string; width?: DimensionValue; height?: DimensionValue; x?: DimensionValue; y?: DimensionValue; alwaysOnTop?: boolean }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmSpawnTerminal": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ command: string; args?: string[]; cwd?: string; title?: string; width?: DimensionValue; height?: DimensionValue; x?: DimensionValue; y?: DimensionValue }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmCloseWindow": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmCloseAllWindows": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "wmFocusWindow": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId?: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmNavigate": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId: string; url: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmMoveWindow": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId: string; x: DimensionValue; y: DimensionValue }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmResizeWindow": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId: string; width: DimensionValue; height: DimensionValue }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmSetFrame": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId: string; x?: DimensionValue; y?: DimensionValue; width?: DimensionValue; height?: DimensionValue }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmArrangeWindows": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ pattern: 'grid' | 'stack' | 'row' | 'column'; gap?: number }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmScreenshot": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId?: string; path: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmStartRecording": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId?: string; path: string; durationMs?: number }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmStopRecording": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ recordingId: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmListRecordings": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "wmEval": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windowId: string; code: string }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmSpawnLayout": {
      "description": "",
      "parameters": {
        "opts": {
          "type": "{ windows: Array<{ type?: 'window' | 'tty'; url?: string; command?: string; args?: string[]; cwd?: string; title?: string; width?: DimensionValue; height?: DimensionValue; x?: DimensionValue; y?: DimensionValue }> }",
          "description": "Parameter opts"
        }
      },
      "required": [
        "opts"
      ],
      "returns": "void"
    },
    "wmGetStatus": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "isBroker": {
      "description": "Whether this instance is acting as the broker.",
      "returns": "boolean"
    },
    "isProducer": {
      "description": "Whether this instance is acting as a producer.",
      "returns": "boolean"
    },
    "isListening": {
      "description": "Whether the IPC server is currently listening (broker) or connected to broker (producer).",
      "returns": "boolean"
    },
    "isClientConnected": {
      "description": "Whether the native app client is currently connected (only meaningful for broker).",
      "returns": "boolean"
    }
  },
  "events": {
    "listening": {
      "name": "listening",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "clientConnected": {
      "name": "clientConnected",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "clientDisconnected": {
      "name": "clientDisconnected",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "windowAck": {
      "name": "windowAck",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "windowClosed": {
      "name": "windowClosed",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "terminalExited": {
      "name": "terminalExited",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "windowFocus": {
      "name": "windowFocus",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by WindowManager",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const wm = container.feature('windowManager', { enable: true, autoListen: true })\n\nconst handle = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })\nhandle.on('close', (msg) => console.log('window closed'))\nawait handle.navigate('https://news.ycombinator.com')\nconst title = await handle.eval('document.title')\nawait handle.close()\n\n// Other features can listen for non-window messages\nwm.on('message', (msg) => console.log('App says:', msg))\n\n// Other features can write raw NDJSON to the app\nwm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })"
    }
  ],
  "types": {
    "SpawnOptions": {
      "description": "Options for spawning a new native browser window. Dimensions and positions accept absolute points or percentage strings (e.g. `\"50%\"`) resolved against the primary display.",
      "properties": {
        "url": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "width": {
          "type": "DimensionValue",
          "description": "",
          "optional": true
        },
        "height": {
          "type": "DimensionValue",
          "description": "",
          "optional": true
        },
        "x": {
          "type": "DimensionValue",
          "description": "",
          "optional": true
        },
        "y": {
          "type": "DimensionValue",
          "description": "",
          "optional": true
        },
        "alwaysOnTop": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "window": {
          "type": "{\n    decorations?: 'normal' | 'hiddenTitleBar' | 'none'\n    transparent?: boolean\n    shadow?: boolean\n    alwaysOnTop?: boolean\n    opacity?: number\n    clickThrough?: boolean\n  }",
          "description": "",
          "optional": true
        }
      }
    },
    "SpawnTTYOptions": {
      "description": "Options for spawning a native terminal window. Dimensions and positions accept absolute points or percentage strings (e.g. `\"50%\"`) resolved against the primary display.",
      "properties": {
        "command": {
          "type": "string",
          "description": "Executable name or path (required)."
        },
        "args": {
          "type": "string[]",
          "description": "Arguments passed after the command.",
          "optional": true
        },
        "cwd": {
          "type": "string",
          "description": "Working directory for the process.",
          "optional": true
        },
        "env": {
          "type": "Record<string, string>",
          "description": "Environment variable overrides.",
          "optional": true
        },
        "cols": {
          "type": "number",
          "description": "Initial terminal columns.",
          "optional": true
        },
        "rows": {
          "type": "number",
          "description": "Initial terminal rows.",
          "optional": true
        },
        "title": {
          "type": "string",
          "description": "Window title.",
          "optional": true
        },
        "width": {
          "type": "DimensionValue",
          "description": "Window width in points.",
          "optional": true
        },
        "height": {
          "type": "DimensionValue",
          "description": "Window height in points.",
          "optional": true
        },
        "x": {
          "type": "DimensionValue",
          "description": "Window x position.",
          "optional": true
        },
        "y": {
          "type": "DimensionValue",
          "description": "Window y position.",
          "optional": true
        },
        "window": {
          "type": "SpawnOptions['window']",
          "description": "Chrome options (decorations, alwaysOnTop, etc.)",
          "optional": true
        }
      }
    },
    "WindowAckResult": {
      "description": "The result returned from a window ack.",
      "properties": {
        "ok": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "windowId": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "value": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "json": {
          "type": "any",
          "description": "",
          "optional": true
        }
      }
    },
    "WindowScreenGrabOptions": {
      "description": "Options for capturing a screenshot from a native window.",
      "properties": {
        "windowId": {
          "type": "string",
          "description": "Window ID. If omitted, the launcher uses the most recent window.",
          "optional": true
        },
        "path": {
          "type": "string",
          "description": "Output file path for the PNG image."
        }
      }
    },
    "WindowVideoOptions": {
      "description": "Options for recording video from a native window.",
      "properties": {
        "windowId": {
          "type": "string",
          "description": "Window ID. If omitted, the launcher uses the most recent window.",
          "optional": true
        },
        "path": {
          "type": "string",
          "description": "Output file path for the video file."
        },
        "durationMs": {
          "type": "number",
          "description": "Recording duration in milliseconds.",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.preferences', {
  "id": "features.preferences",
  "description": "The Preferences feature manages the global preferences of the Agentic Loop and allows users to control things like the default coding assistant to use when running tasks / plays etc.",
  "shortcut": "features.preferences",
  "className": "Preferences",
  "methods": {
    "afterInitialize": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "configFilePath": {
      "description": "",
      "returns": "any"
    },
    "loopConfigFileData": {
      "description": "",
      "returns": "any"
    },
    "manifestPreferences": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {},
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const preferences = container.feature('preferences')"
    }
  ]
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
  "envVars": [],
  "types": {
    "WorkspaceEntry": {
      "description": "",
      "properties": {
        "name": {
          "type": "string",
          "description": ""
        },
        "path": {
          "type": "string",
          "description": ""
        },
        "aliases": {
          "type": "string[]",
          "description": ""
        }
      }
    }
  }
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
  "envVars": [],
  "types": {
    "CapabilityResult": {
      "description": "",
      "properties": {
        "available": {
          "type": "boolean",
          "description": ""
        },
        "missing": {
          "type": "string[]",
          "description": ""
        }
      }
    },
    "VoiceConfig": {
      "description": "",
      "properties": {
        "voiceId": {
          "type": "string",
          "description": ""
        },
        "modelId": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "voiceSettings": {
          "type": "any",
          "description": "",
          "optional": true
        },
        "conversationModePrefix": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "maxChunkLength": {
          "type": "number",
          "description": "",
          "optional": true
        }
      }
    }
  }
});

setBuildTimeData('features.workflowService', {
  "id": "features.workflowService",
  "description": "WorkflowService — one Express server that: - Discovers all workflows public directories and serves them statically - Loads ContentDB once and attaches it to app.locals.docs - Serves shared CSS at /shared/base.css - Exposes GET /api/workflows - Renders a landing page at /",
  "shortcut": "features.workflowService",
  "className": "WorkflowService",
  "methods": {
    "start": {
      "description": "Start the unified workflow server. Discovers all workflows, mounts their public dirs, loads ContentDB, and begins listening.",
      "parameters": {},
      "required": [],
      "returns": "Promise<this>"
    },
    "stop": {
      "description": "Stop the server and clean up.",
      "parameters": {},
      "required": [],
      "returns": "void"
    }
  },
  "getters": {
    "expressServer": {
      "description": "",
      "returns": "ExpressServer"
    },
    "port": {
      "description": "",
      "returns": "number | null"
    },
    "isListening": {
      "description": "",
      "returns": "boolean"
    }
  },
  "events": {
    "started": {
      "name": "started",
      "description": "Event emitted by WorkflowService",
      "arguments": {}
    },
    "stopped": {
      "name": "stopped",
      "description": "Event emitted by WorkflowService",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});

setBuildTimeData('features.instanceRegistry', {
  "id": "features.instanceRegistry",
  "description": "Manages ~/.luca/agentic-loops/ as a shared registry so multiple luca main processes on the same machine can coexist without port collisions. Instance ID is derived from the CWD basename (e.g. \"@agentic-loop\").",
  "shortcut": "features.instanceRegistry",
  "className": "InstanceRegistry",
  "methods": {
    "ensureDir": {
      "description": "Ensure the registry directory exists",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "listInstances": {
      "description": "Read all currently registered instances",
      "parameters": {},
      "required": [],
      "returns": "InstanceEntry[]"
    },
    "getInstance": {
      "description": "Get a specific instance by ID",
      "parameters": {
        "id": {
          "type": "string",
          "description": "Parameter id"
        }
      },
      "required": [
        "id"
      ],
      "returns": "InstanceEntry | null"
    },
    "getSelf": {
      "description": "Get the entry for the current project, if registered",
      "parameters": {},
      "required": [],
      "returns": "InstanceEntry | null"
    },
    "claimedPorts": {
      "description": "Collect all ports currently claimed by other instances",
      "parameters": {},
      "required": [],
      "returns": "Set<number>"
    },
    "allocatePorts": {
      "description": "Allocate ports for this instance, avoiding collisions with other registered instances and verifying ports are actually open.",
      "parameters": {},
      "required": [],
      "returns": "Promise<InstanceEntry['ports']>"
    },
    "register": {
      "description": "Register this instance with its allocated ports",
      "parameters": {
        "ports": {
          "type": "InstanceEntry['ports']",
          "description": "Parameter ports"
        }
      },
      "required": [
        "ports"
      ],
      "returns": "InstanceEntry"
    },
    "deregister": {
      "description": "Deregister this instance (called on shutdown)",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "pruneStale": {
      "description": "Clean up stale entries whose processes are no longer alive",
      "parameters": {},
      "required": [],
      "returns": "string[]"
    }
  },
  "getters": {
    "registryDir": {
      "description": "",
      "returns": "any"
    },
    "instanceId": {
      "description": "",
      "returns": "string"
    },
    "instanceFile": {
      "description": "",
      "returns": "string"
    }
  },
  "events": {},
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
      "description": "Watch for incoming messages. Emits events: 'message' — new message received (payload: Message) 'error'   — stderr output from imsg watch 'stop'    — watcher was stopped Returns { stop() } to kill the watcher process.",
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
            }
          }
        }
      },
      "required": [],
      "returns": "{ stop: () => void }"
    }
  },
  "getters": {},
  "events": {
    "message": {
      "name": "message",
      "description": "Event emitted by Imsg",
      "arguments": {}
    },
    "error": {
      "name": "error",
      "description": "Event emitted by Imsg",
      "arguments": {}
    },
    "stop": {
      "name": "stop",
      "description": "Event emitted by Imsg",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "examples": [
    {
      "language": "ts",
      "code": "const imsg = container.feature('imsg')\nconst chats = await imsg.chats({ limit: 5 })\nconst messages = await imsg.history(6, { limit: 10 })\nawait imsg.send('+15551234567', 'Hello from luca')"
    }
  ],
  "types": {
    "Chat": {
      "description": "",
      "properties": {
        "id": {
          "type": "number",
          "description": ""
        },
        "name": {
          "type": "string",
          "description": ""
        },
        "identifier": {
          "type": "string",
          "description": ""
        },
        "service": {
          "type": "string",
          "description": ""
        },
        "last_message_at": {
          "type": "string",
          "description": ""
        }
      }
    },
    "HistoryOptions": {
      "description": "",
      "properties": {
        "limit": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "participants": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "start": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "end": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "attachments": {
          "type": "boolean",
          "description": "",
          "optional": true
        }
      }
    },
    "Message": {
      "description": "",
      "properties": {
        "id": {
          "type": "number",
          "description": ""
        },
        "guid": {
          "type": "string",
          "description": ""
        },
        "chat_id": {
          "type": "number",
          "description": ""
        },
        "sender": {
          "type": "string",
          "description": ""
        },
        "text": {
          "type": "string",
          "description": ""
        },
        "is_from_me": {
          "type": "boolean",
          "description": ""
        },
        "created_at": {
          "type": "string",
          "description": ""
        },
        "destination_caller_id": {
          "type": "string",
          "description": ""
        },
        "reactions": {
          "type": "any[]",
          "description": ""
        },
        "attachments": {
          "type": "any[]",
          "description": ""
        }
      }
    },
    "SendResult": {
      "description": "",
      "properties": {
        "success": {
          "type": "boolean",
          "description": ""
        },
        "error": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    },
    "WatchOptions": {
      "description": "",
      "properties": {
        "chatId": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "participants": {
          "type": "string",
          "description": "",
          "optional": true
        },
        "sinceRowid": {
          "type": "number",
          "description": "",
          "optional": true
        },
        "attachments": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "reactions": {
          "type": "boolean",
          "description": "",
          "optional": true
        },
        "debounce": {
          "type": "string",
          "description": "",
          "optional": true
        }
      }
    }
  }
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

setBuildTimeData('features.workflowLibrary', {
  "id": "features.workflowLibrary",
  "description": "WorkflowLibrary helper",
  "shortcut": "features.workflowLibrary",
  "className": "WorkflowLibrary",
  "methods": {
    "afterInitialize": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "discover": {
      "description": "Scan the workflows directory and parse each ABOUT.md",
      "parameters": {},
      "required": [],
      "returns": "Promise<WorkflowInfo[]>"
    },
    "get": {
      "description": "Get a specific workflow by name",
      "parameters": {
        "name": {
          "type": "string",
          "description": "Parameter name"
        }
      },
      "required": [
        "name"
      ],
      "returns": "WorkflowInfo | undefined"
    },
    "listAvailableWorkflows": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ tag?: string }",
          "description": "Parameter options"
        }
      },
      "required": [],
      "returns": "Promise<WorkflowInfo[]>"
    },
    "viewWorkflow": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ name: string }",
          "description": "Parameter options"
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<WorkflowInfo & { content?: string }>"
    },
    "runWorkflow": {
      "description": "",
      "parameters": {
        "options": {
          "type": "{ name: string }",
          "description": "Parameter options"
        }
      },
      "required": [
        "options"
      ],
      "returns": "Promise<{ url: string; pid?: number }>"
    },
    "generateSummary": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "setupToolsConsumer": {
      "description": "",
      "parameters": {
        "assistant": {
          "type": "Assistant",
          "description": "Parameter assistant"
        }
      },
      "required": [
        "assistant"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "workflowsDir": {
      "description": "",
      "returns": "string"
    },
    "workflows": {
      "description": "",
      "returns": "WorkflowInfo[]"
    },
    "isLoaded": {
      "description": "",
      "returns": "boolean"
    },
    "available": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {
    "discovered": {
      "name": "discovered",
      "description": "Event emitted by WorkflowLibrary",
      "arguments": {}
    },
    "workflowStarted": {
      "name": "workflowStarted",
      "description": "Event emitted by WorkflowLibrary",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": [],
  "types": {
    "WorkflowInfo": {
      "description": "",
      "properties": {
        "name": {
          "type": "string",
          "description": ""
        },
        "title": {
          "type": "string",
          "description": ""
        },
        "description": {
          "type": "string",
          "description": ""
        },
        "tags": {
          "type": "string[]",
          "description": ""
        },
        "folderPath": {
          "type": "string",
          "description": ""
        },
        "hasServeHook": {
          "type": "boolean",
          "description": ""
        },
        "hasPublicDir": {
          "type": "boolean",
          "description": ""
        },
        "raw": {
          "type": "Record<string, any>",
          "description": ""
        }
      }
    }
  }
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
      "returns": "VoiceListener"
    },
    "unlock": {
      "description": "Unlock the listener, allowing it to react to wakewords",
      "parameters": {},
      "required": [],
      "returns": "VoiceListener"
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
  ],
  "types": {
    "CapabilityResult": {
      "description": "",
      "properties": {
        "available": {
          "type": "boolean",
          "description": ""
        },
        "missing": {
          "type": "string[]",
          "description": ""
        }
      }
    }
  }
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

setBuildTimeData('features.communications', {
  "id": "features.communications",
  "description": "The Communications Feature is a centralized hub that monitors multiple channels for incoming messages, and reacts when they arrive.  The communications feature can also be used to send messages back over those same channels. Supported channels are imessage, telegram, and gmail for now",
  "shortcut": "features.communications",
  "className": "Communications",
  "methods": {
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
    "start": {
      "description": "",
      "parameters": {},
      "required": [],
      "returns": "void"
    },
    "activateChannel": {
      "description": "",
      "parameters": {
        "channelName": {
          "type": "Channel",
          "description": "Parameter channelName"
        },
        "options": {
          "type": "any",
          "description": "Parameter options"
        }
      },
      "required": [
        "channelName",
        "options"
      ],
      "returns": "void"
    }
  },
  "getters": {
    "imessage": {
      "description": "",
      "returns": "any"
    },
    "activeChannels": {
      "description": "",
      "returns": "any"
    },
    "telegramBot": {
      "description": "",
      "returns": "any"
    },
    "isPaused": {
      "description": "",
      "returns": "any"
    },
    "isStarted": {
      "description": "",
      "returns": "any"
    }
  },
  "events": {
    "paused": {
      "name": "paused",
      "description": "Event emitted by Communications",
      "arguments": {}
    },
    "unpaused": {
      "name": "unpaused",
      "description": "Event emitted by Communications",
      "arguments": {}
    },
    "message": {
      "name": "message",
      "description": "Event emitted by Communications",
      "arguments": {}
    },
    "started": {
      "name": "started",
      "description": "Event emitted by Communications",
      "arguments": {}
    }
  },
  "state": {},
  "options": {},
  "envVars": []
});
export const introspectionData = [
  {
    "id": "features.chatService",
    "description": "Reusable real-time chat service. Manages WebSocket connections, assistant sessions, and the streaming protocol (init → user_message → chunks/tool events → complete). Usage: const chatService = container.feature('chatService', { threadPrefix: 'my-workflow' }) chatService.attach(httpServer)",
    "shortcut": "features.chatService",
    "className": "ChatService",
    "methods": {
      "setVoiceChat": {
        "description": "Attach a VoiceChat instance for voice responses. When set, the service can route messages through voice based on voiceMode.",
        "parameters": {
          "voiceChat": {
            "type": "VoiceChat",
            "description": "Parameter voiceChat"
          }
        },
        "required": [
          "voiceChat"
        ],
        "returns": "void"
      },
      "setVoiceMode": {
        "description": "",
        "parameters": {
          "mode": {
            "type": "VoiceMode",
            "description": "Parameter mode"
          }
        },
        "required": [
          "mode"
        ],
        "returns": "void"
      },
      "onMessage": {
        "description": "Register a handler for custom message types (e.g. 'start_review'). Called for any message that isn't 'init' or 'user_message'.",
        "parameters": {
          "handler": {
            "type": "CustomMessageHandler",
            "description": "Parameter handler"
          }
        },
        "required": [
          "handler"
        ],
        "returns": "void"
      },
      "attach": {
        "description": "Attach a WebSocket server to an existing HTTP server. Call this after your express/HTTP server is listening.",
        "parameters": {
          "httpServer": {
            "type": "HttpServer",
            "description": "Parameter httpServer"
          }
        },
        "required": [
          "httpServer"
        ],
        "returns": "WebSocketServer"
      },
      "listen": {
        "description": "Create a standalone WebSocket server on a given port.",
        "parameters": {
          "port": {
            "type": "number",
            "description": "Parameter port"
          },
          "host": {
            "type": "any",
            "description": "Parameter host"
          }
        },
        "required": [
          "port"
        ],
        "returns": "WebSocketServer"
      },
      "resolveAssistantName": {
        "description": "Resolve a short assistant name to its full registered name.",
        "parameters": {
          "shortName": {
            "type": "string",
            "description": "Parameter shortName"
          }
        },
        "required": [
          "shortName"
        ],
        "returns": "string | null"
      },
      "listAssistants": {
        "description": "List available assistants as { id, name } pairs.",
        "parameters": {},
        "required": [],
        "returns": "Array<{ id: string; name: string }>"
      },
      "getOrCreateSession": {
        "description": "Get or create a session for the given sessionId + assistantId combo. When a voiceChat is attached, its assistant is used as the session assistant.",
        "parameters": {
          "sessionId": {
            "type": "string",
            "description": "Parameter sessionId"
          },
          "assistantId": {
            "type": "string",
            "description": "Parameter assistantId"
          }
        },
        "required": [
          "sessionId",
          "assistantId"
        ],
        "returns": "Promise<ChatSession | null>"
      },
      "streamResponse": {
        "description": "Send a message to an assistant and stream the response over a WebSocket. Can be used directly without WebSocket by passing event callbacks instead.",
        "parameters": {
          "session": {
            "type": "ChatSession",
            "description": "Parameter session",
            "properties": {
              "assistant": {
                "type": "Assistant",
                "description": ""
              },
              "assistantId": {
                "type": "string",
                "description": ""
              },
              "sessionKey": {
                "type": "string",
                "description": ""
              }
            }
          },
          "text": {
            "type": "string",
            "description": "Parameter text"
          },
          "callbacks": {
            "type": "{\n\t\t\tonStart: (messageId: string) => void\n\t\t\tonChunk: (messageId: string, textDelta: string) => void\n\t\t\tonToolStart: (id: string, name: string, startedAt: number) => void\n\t\t\tonToolEnd: (id: string, name: string, ok: boolean, endedAt: number, durationMs: number, detail?: string) => void\n\t\t\tonComplete: (messageId: string, text: string) => void\n\t\t\tonError: (message: string) => void\n\t\t}",
            "description": "Parameter callbacks"
          }
        },
        "required": [
          "session",
          "text",
          "callbacks"
        ],
        "returns": "Promise<string>"
      },
      "shutdown": {
        "description": "Close all sessions and the WebSocket server.",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "voiceChat": {
        "description": "",
        "returns": "VoiceChat | null"
      },
      "voiceMode": {
        "description": "",
        "returns": "VoiceMode"
      },
      "assistantsManager": {
        "description": "",
        "returns": "AssistantsManager"
      }
    },
    "events": {
      "voiceModeChanged": {
        "name": "voiceModeChanged",
        "description": "Event emitted by ChatService",
        "arguments": {}
      },
      "attached": {
        "name": "attached",
        "description": "Event emitted by ChatService",
        "arguments": {}
      },
      "listening": {
        "name": "listening",
        "description": "Event emitted by ChatService",
        "arguments": {}
      },
      "sessionCreated": {
        "name": "sessionCreated",
        "description": "Event emitted by ChatService",
        "arguments": {}
      },
      "shutdown": {
        "name": "shutdown",
        "description": "Event emitted by ChatService",
        "arguments": {}
      },
      "connection": {
        "name": "connection",
        "description": "Event emitted by ChatService",
        "arguments": {}
      },
      "disconnection": {
        "name": "disconnection",
        "description": "Event emitted by ChatService",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "types": {
      "ChatSession": {
        "description": "── Session ──",
        "properties": {
          "assistant": {
            "type": "Assistant",
            "description": ""
          },
          "assistantId": {
            "type": "string",
            "description": ""
          },
          "sessionKey": {
            "type": "string",
            "description": ""
          }
        }
      }
    }
  },
  {
    "id": "features.gws",
    "description": "Google Workspace CLI wrapper providing access to the full GWS API surface via subprocess. Supports profile-based credential management and typed sub-interfaces for Gmail, Sheets, Calendar, Drive, Docs, and Chat.",
    "shortcut": "features.gws",
    "className": "Gws",
    "methods": {
      "configDirForProfile": {
        "description": "Returns the config directory for a given profile. No profile uses ~/.config/gws, named profiles use ~/.config/gws-<name>.",
        "parameters": {
          "profile": {
            "type": "string | null",
            "description": "Parameter profile"
          }
        },
        "required": [],
        "returns": "string"
      },
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
        "description": "Activates a named credential profile. Throws if ~/.config/gws-<name> does not exist.",
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
        "description": "Lists all available credential profile names by scanning for ~/.config/gws-* directories.",
        "parameters": {},
        "required": [],
        "returns": "string[]"
      },
      "gwsListProfiles": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "gwsSendEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ to: string; subject: string; body: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsSearchEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ query: string; maxResults?: number; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsReadEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ id: string; markAsRead?: boolean; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsTriageEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ max?: number; query?: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsTrashEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ id: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsArchiveEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ id: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsValidateEmail": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ id: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsGetCalendarAgenda": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ days?: number; calendar?: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsCreateCalendarEvent": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{\n    summary: string; start: string; end?: string; duration?: number;\n    calendar?: string; location?: string; description?: string;\n    attendees?: string[]; profile?: string\n  }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsReadSpreadsheet": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ spreadsheet: string; range: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsAppendToSpreadsheet": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ spreadsheet: string; values?: string; jsonValues?: string[][]; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsSearchDrive": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ query: string; pageSize?: number; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsSendChatMessage": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ space: string; text: string; profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "gwsCheckAuth": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ profile?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "configDir": {
        "description": "",
        "returns": "string"
      },
      "currentProfile": {
        "description": "Returns the name of the currently active credential profile, or null if none is set.",
        "returns": "string | null"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "types": {
      "GwsExecOptions": {
        "description": "Interfaces",
        "properties": {
          "params": {
            "type": "Record<string, string | number | boolean>",
            "description": "",
            "optional": true
          },
          "flags": {
            "type": "string[]",
            "description": "",
            "optional": true
          },
          "json": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "ndjson": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "profile": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.windowManager",
    "description": "WindowManager Feature — Native window control via LucaVoiceLauncher Uses a broker/producer architecture so multiple luca processes can trigger window operations without competing for the same Unix socket. **Architecture:** - The first process to call `listen()` becomes the **broker**. It owns the app-facing socket (`ipc-window.sock`) and a control socket (`ipc-window-control.sock`). - Subsequent processes detect the broker and become **producers**. They connect to the control socket and route commands through the broker. - The broker forwards producer commands to the native app and routes acks and lifecycle events back to the originating producer. **Protocol:** - Bun listens on a Unix domain socket; the native app connects as a client - Window dispatch commands are sent as NDJSON with a `window` field - The app executes window commands and sends back `windowAck` messages - Any non-windowAck message from the app is emitted as a `message` event - Other features can use `send()` to write arbitrary NDJSON to the app **Capabilities:** - Spawn native browser windows with configurable chrome - Navigate, focus, close, and eval JavaScript in windows - Multiple luca processes can trigger window operations simultaneously - Automatic broker detection and producer fallback Observable state includes `windows` (open window metadata), `pendingOperations` (in-flight command ids), and `producerCount` (broker). Sockets, promises, and `WindowHandle` instances stay internal. **Producer state:** The broker pushes `windowStateSync` on the control socket when a producer connects and whenever the window roster changes, so every process sees the same `windows` / `windowCount` / `clientConnected` as the broker (not only its own acks).",
    "shortcut": "features.windowManager",
    "className": "WindowManager",
    "methods": {
      "enable": {
        "description": "",
        "parameters": {
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "listen": {
        "description": "Start the window manager. Automatically detects whether a broker already exists and either becomes the broker or connects as a producer. - If no broker is running: becomes the broker, binds the app socket and a control socket for producers. - If a broker is already running: connects as a producer through the control socket.",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Override the configured app socket path"
          }
        },
        "required": [],
        "returns": "Promise<this>"
      },
      "cleanupSocket": {
        "description": "Remove stale socket files without starting or stopping the server. Useful when a previous process crashed and left dead sockets behind. Will not remove sockets that have live listeners.",
        "parameters": {
          "socketPath": {
            "type": "string",
            "description": "Override the configured socket path"
          }
        },
        "required": [],
        "returns": "Promise<boolean>"
      },
      "stop": {
        "description": "Stop the window manager and clean up all connections. Rejects any pending window operation requests.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "spawn": {
        "description": "Spawn a new native browser window. Sends a window dispatch to the app and waits for the ack.",
        "parameters": {
          "opts": {
            "type": "SpawnOptions",
            "description": "Window configuration (url, dimensions, chrome options)",
            "properties": {
              "url": {
                "type": "string",
                "description": ""
              },
              "width": {
                "type": "DimensionValue",
                "description": ""
              },
              "height": {
                "type": "DimensionValue",
                "description": ""
              },
              "x": {
                "type": "DimensionValue",
                "description": ""
              },
              "y": {
                "type": "DimensionValue",
                "description": ""
              },
              "alwaysOnTop": {
                "type": "boolean",
                "description": ""
              },
              "window": {
                "type": "{\n    decorations?: 'normal' | 'hiddenTitleBar' | 'none'\n    transparent?: boolean\n    shadow?: boolean\n    alwaysOnTop?: boolean\n    opacity?: number\n    clickThrough?: boolean\n  }",
                "description": ""
              }
            }
          }
        },
        "required": [],
        "returns": "Promise<WindowHandle>"
      },
      "spawnTTY": {
        "description": "Spawn a native terminal window running a command. The terminal is read-only — stdout/stderr are rendered with ANSI support. Closing the window terminates the process.",
        "parameters": {
          "opts": {
            "type": "SpawnTTYOptions",
            "description": "Terminal configuration (command, args, cwd, dimensions, etc.)",
            "properties": {
              "command": {
                "type": "string",
                "description": "Executable name or path (required)."
              },
              "args": {
                "type": "string[]",
                "description": "Arguments passed after the command."
              },
              "cwd": {
                "type": "string",
                "description": "Working directory for the process."
              },
              "env": {
                "type": "Record<string, string>",
                "description": "Environment variable overrides."
              },
              "cols": {
                "type": "number",
                "description": "Initial terminal columns."
              },
              "rows": {
                "type": "number",
                "description": "Initial terminal rows."
              },
              "title": {
                "type": "string",
                "description": "Window title."
              },
              "width": {
                "type": "DimensionValue",
                "description": "Window width in points."
              },
              "height": {
                "type": "DimensionValue",
                "description": "Window height in points."
              },
              "x": {
                "type": "DimensionValue",
                "description": "Window x position."
              },
              "y": {
                "type": "DimensionValue",
                "description": "Window y position."
              },
              "window": {
                "type": "SpawnOptions['window']",
                "description": "Chrome options (decorations, alwaysOnTop, etc.)"
              }
            }
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<WindowHandle>"
      },
      "focus": {
        "description": "Bring a window to the front.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID. If omitted, the app uses the most recent window."
          }
        },
        "required": [],
        "returns": "Promise<WindowAckResult>"
      },
      "close": {
        "description": "Close a window.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID. If omitted, the app closes the most recent window."
          }
        },
        "required": [],
        "returns": "Promise<WindowAckResult>"
      },
      "navigate": {
        "description": "Navigate a window to a new URL.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "url": {
            "type": "string",
            "description": "The URL to navigate to"
          }
        },
        "required": [
          "windowId",
          "url"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "eval": {
        "description": "Evaluate JavaScript in a window's web view.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "code": {
            "type": "string",
            "description": "JavaScript code to evaluate"
          },
          "opts": {
            "type": "{ timeoutMs?: number; returnJson?: boolean }",
            "description": "timeoutMs (default 5000), returnJson (default true)"
          }
        },
        "required": [
          "windowId",
          "code"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "screengrab": {
        "description": "Capture a PNG screenshot from a window.",
        "parameters": {
          "opts": {
            "type": "WindowScreenGrabOptions",
            "description": "Window target and output path",
            "properties": {
              "windowId": {
                "type": "string",
                "description": "Window ID. If omitted, the launcher uses the most recent window."
              },
              "path": {
                "type": "string",
                "description": "Output file path for the PNG image."
              }
            }
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "video": {
        "description": "Record a video from a window to disk.",
        "parameters": {
          "opts": {
            "type": "WindowVideoOptions",
            "description": "Window target, output path, and optional duration",
            "properties": {
              "windowId": {
                "type": "string",
                "description": "Window ID. If omitted, the launcher uses the most recent window."
              },
              "path": {
                "type": "string",
                "description": "Output file path for the video file."
              },
              "durationMs": {
                "type": "number",
                "description": "Recording duration in milliseconds."
              }
            }
          }
        },
        "required": [
          "opts"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "move": {
        "description": "Move a window to a new position.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "x": {
            "type": "DimensionValue",
            "description": "New x position (absolute points or percentage string like \"25%\")"
          },
          "y": {
            "type": "DimensionValue",
            "description": "New y position (absolute points or percentage string like \"10%\")"
          }
        },
        "required": [
          "windowId",
          "x",
          "y"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "resize": {
        "description": "Resize a window.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "width": {
            "type": "DimensionValue",
            "description": "New width (absolute points or percentage string like \"50%\")"
          },
          "height": {
            "type": "DimensionValue",
            "description": "New height (absolute points or percentage string like \"70%\")"
          }
        },
        "required": [
          "windowId",
          "width",
          "height"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "setFrame": {
        "description": "Set a window's full frame (position and/or size).",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          },
          "frame": {
            "type": "{ x?: DimensionValue; y?: DimensionValue; width?: DimensionValue; height?: DimensionValue }",
            "description": "Object with x, y, width, height (all optional, supports percentage strings)"
          }
        },
        "required": [
          "windowId",
          "frame"
        ],
        "returns": "Promise<WindowAckResult>"
      },
      "window": {
        "description": "Get a WindowHandle for chainable operations on a specific window. Returns the tracked handle if one exists, otherwise creates a new one.",
        "parameters": {
          "windowId": {
            "type": "string",
            "description": "The window ID"
          }
        },
        "required": [
          "windowId"
        ],
        "returns": "WindowHandle"
      },
      "spawnLayout": {
        "description": "Spawn multiple windows in parallel from a layout configuration. Returns handles in the same order as the config entries.",
        "parameters": {
          "config": {
            "type": "LayoutEntry[]",
            "description": "Array of layout entries (window or tty)"
          }
        },
        "required": [
          "config"
        ],
        "returns": "Promise<WindowHandle[]>",
        "examples": [
          {
            "language": "ts",
            "code": "const handles = await wm.spawnLayout([\n { type: 'window', url: 'https://google.com', width: 800, height: 600 },\n { type: 'tty', command: 'htop' },\n { url: 'https://github.com' }, // defaults to window\n])"
          }
        ]
      },
      "spawnLayouts": {
        "description": "Spawn multiple layouts sequentially. Each layout's windows spawn in parallel, but the next layout waits for the previous one to fully complete.",
        "parameters": {
          "configs": {
            "type": "LayoutEntry[][]",
            "description": "Array of layout configurations"
          }
        },
        "required": [
          "configs"
        ],
        "returns": "Promise<WindowHandle[][]>",
        "examples": [
          {
            "language": "ts",
            "code": "const [firstBatch, secondBatch] = await wm.spawnLayouts([\n [{ url: 'https://google.com' }, { url: 'https://github.com' }],\n [{ type: 'tty', command: 'htop' }],\n])"
          }
        ]
      },
      "send": {
        "description": "Write an NDJSON message to the connected app client. In producer mode, routes through the broker. Public so other features can send arbitrary protocol messages over the same socket.",
        "parameters": {
          "msg": {
            "type": "Record<string, any>",
            "description": "The message object to send (will be JSON-serialized + newline)"
          }
        },
        "required": [
          "msg"
        ],
        "returns": "boolean"
      },
      "wmListWindows": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "wmSpawnBrowser": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ url?: string; width?: DimensionValue; height?: DimensionValue; x?: DimensionValue; y?: DimensionValue; alwaysOnTop?: boolean }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmSpawnTerminal": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ command: string; args?: string[]; cwd?: string; title?: string; width?: DimensionValue; height?: DimensionValue; x?: DimensionValue; y?: DimensionValue }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmCloseWindow": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmCloseAllWindows": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "wmFocusWindow": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId?: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmNavigate": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId: string; url: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmMoveWindow": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId: string; x: DimensionValue; y: DimensionValue }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmResizeWindow": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId: string; width: DimensionValue; height: DimensionValue }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmSetFrame": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId: string; x?: DimensionValue; y?: DimensionValue; width?: DimensionValue; height?: DimensionValue }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmArrangeWindows": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ pattern: 'grid' | 'stack' | 'row' | 'column'; gap?: number }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmScreenshot": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId?: string; path: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmStartRecording": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId?: string; path: string; durationMs?: number }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmStopRecording": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ recordingId: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmListRecordings": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "wmEval": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windowId: string; code: string }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmSpawnLayout": {
        "description": "",
        "parameters": {
          "opts": {
            "type": "{ windows: Array<{ type?: 'window' | 'tty'; url?: string; command?: string; args?: string[]; cwd?: string; title?: string; width?: DimensionValue; height?: DimensionValue; x?: DimensionValue; y?: DimensionValue }> }",
            "description": "Parameter opts"
          }
        },
        "required": [
          "opts"
        ],
        "returns": "void"
      },
      "wmGetStatus": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "isBroker": {
        "description": "Whether this instance is acting as the broker.",
        "returns": "boolean"
      },
      "isProducer": {
        "description": "Whether this instance is acting as a producer.",
        "returns": "boolean"
      },
      "isListening": {
        "description": "Whether the IPC server is currently listening (broker) or connected to broker (producer).",
        "returns": "boolean"
      },
      "isClientConnected": {
        "description": "Whether the native app client is currently connected (only meaningful for broker).",
        "returns": "boolean"
      }
    },
    "events": {
      "listening": {
        "name": "listening",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "clientConnected": {
        "name": "clientConnected",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "clientDisconnected": {
        "name": "clientDisconnected",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "windowAck": {
        "name": "windowAck",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "windowClosed": {
        "name": "windowClosed",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "terminalExited": {
        "name": "terminalExited",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "windowFocus": {
        "name": "windowFocus",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by WindowManager",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const wm = container.feature('windowManager', { enable: true, autoListen: true })\n\nconst handle = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })\nhandle.on('close', (msg) => console.log('window closed'))\nawait handle.navigate('https://news.ycombinator.com')\nconst title = await handle.eval('document.title')\nawait handle.close()\n\n// Other features can listen for non-window messages\nwm.on('message', (msg) => console.log('App says:', msg))\n\n// Other features can write raw NDJSON to the app\nwm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })"
      }
    ],
    "types": {
      "SpawnOptions": {
        "description": "Options for spawning a new native browser window. Dimensions and positions accept absolute points or percentage strings (e.g. `\"50%\"`) resolved against the primary display.",
        "properties": {
          "url": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "width": {
            "type": "DimensionValue",
            "description": "",
            "optional": true
          },
          "height": {
            "type": "DimensionValue",
            "description": "",
            "optional": true
          },
          "x": {
            "type": "DimensionValue",
            "description": "",
            "optional": true
          },
          "y": {
            "type": "DimensionValue",
            "description": "",
            "optional": true
          },
          "alwaysOnTop": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "window": {
            "type": "{\n    decorations?: 'normal' | 'hiddenTitleBar' | 'none'\n    transparent?: boolean\n    shadow?: boolean\n    alwaysOnTop?: boolean\n    opacity?: number\n    clickThrough?: boolean\n  }",
            "description": "",
            "optional": true
          }
        }
      },
      "SpawnTTYOptions": {
        "description": "Options for spawning a native terminal window. Dimensions and positions accept absolute points or percentage strings (e.g. `\"50%\"`) resolved against the primary display.",
        "properties": {
          "command": {
            "type": "string",
            "description": "Executable name or path (required)."
          },
          "args": {
            "type": "string[]",
            "description": "Arguments passed after the command.",
            "optional": true
          },
          "cwd": {
            "type": "string",
            "description": "Working directory for the process.",
            "optional": true
          },
          "env": {
            "type": "Record<string, string>",
            "description": "Environment variable overrides.",
            "optional": true
          },
          "cols": {
            "type": "number",
            "description": "Initial terminal columns.",
            "optional": true
          },
          "rows": {
            "type": "number",
            "description": "Initial terminal rows.",
            "optional": true
          },
          "title": {
            "type": "string",
            "description": "Window title.",
            "optional": true
          },
          "width": {
            "type": "DimensionValue",
            "description": "Window width in points.",
            "optional": true
          },
          "height": {
            "type": "DimensionValue",
            "description": "Window height in points.",
            "optional": true
          },
          "x": {
            "type": "DimensionValue",
            "description": "Window x position.",
            "optional": true
          },
          "y": {
            "type": "DimensionValue",
            "description": "Window y position.",
            "optional": true
          },
          "window": {
            "type": "SpawnOptions['window']",
            "description": "Chrome options (decorations, alwaysOnTop, etc.)",
            "optional": true
          }
        }
      },
      "WindowAckResult": {
        "description": "The result returned from a window ack.",
        "properties": {
          "ok": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "windowId": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "value": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "json": {
            "type": "any",
            "description": "",
            "optional": true
          }
        }
      },
      "WindowScreenGrabOptions": {
        "description": "Options for capturing a screenshot from a native window.",
        "properties": {
          "windowId": {
            "type": "string",
            "description": "Window ID. If omitted, the launcher uses the most recent window.",
            "optional": true
          },
          "path": {
            "type": "string",
            "description": "Output file path for the PNG image."
          }
        }
      },
      "WindowVideoOptions": {
        "description": "Options for recording video from a native window.",
        "properties": {
          "windowId": {
            "type": "string",
            "description": "Window ID. If omitted, the launcher uses the most recent window.",
            "optional": true
          },
          "path": {
            "type": "string",
            "description": "Output file path for the video file."
          },
          "durationMs": {
            "type": "number",
            "description": "Recording duration in milliseconds.",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.preferences",
    "description": "The Preferences feature manages the global preferences of the Agentic Loop and allows users to control things like the default coding assistant to use when running tasks / plays etc.",
    "shortcut": "features.preferences",
    "className": "Preferences",
    "methods": {
      "afterInitialize": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "configFilePath": {
        "description": "",
        "returns": "any"
      },
      "loopConfigFileData": {
        "description": "",
        "returns": "any"
      },
      "manifestPreferences": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {},
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const preferences = container.feature('preferences')"
      }
    ]
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
    "envVars": [],
    "types": {
      "WorkspaceEntry": {
        "description": "",
        "properties": {
          "name": {
            "type": "string",
            "description": ""
          },
          "path": {
            "type": "string",
            "description": ""
          },
          "aliases": {
            "type": "string[]",
            "description": ""
          }
        }
      }
    }
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
    "envVars": [],
    "types": {
      "CapabilityResult": {
        "description": "",
        "properties": {
          "available": {
            "type": "boolean",
            "description": ""
          },
          "missing": {
            "type": "string[]",
            "description": ""
          }
        }
      },
      "VoiceConfig": {
        "description": "",
        "properties": {
          "voiceId": {
            "type": "string",
            "description": ""
          },
          "modelId": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "voiceSettings": {
            "type": "any",
            "description": "",
            "optional": true
          },
          "conversationModePrefix": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "maxChunkLength": {
            "type": "number",
            "description": "",
            "optional": true
          }
        }
      }
    }
  },
  {
    "id": "features.workflowService",
    "description": "WorkflowService — one Express server that: - Discovers all workflows public directories and serves them statically - Loads ContentDB once and attaches it to app.locals.docs - Serves shared CSS at /shared/base.css - Exposes GET /api/workflows - Renders a landing page at /",
    "shortcut": "features.workflowService",
    "className": "WorkflowService",
    "methods": {
      "start": {
        "description": "Start the unified workflow server. Discovers all workflows, mounts their public dirs, loads ContentDB, and begins listening.",
        "parameters": {},
        "required": [],
        "returns": "Promise<this>"
      },
      "stop": {
        "description": "Stop the server and clean up.",
        "parameters": {},
        "required": [],
        "returns": "void"
      }
    },
    "getters": {
      "expressServer": {
        "description": "",
        "returns": "ExpressServer"
      },
      "port": {
        "description": "",
        "returns": "number | null"
      },
      "isListening": {
        "description": "",
        "returns": "boolean"
      }
    },
    "events": {
      "started": {
        "name": "started",
        "description": "Event emitted by WorkflowService",
        "arguments": {}
      },
      "stopped": {
        "name": "stopped",
        "description": "Event emitted by WorkflowService",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  },
  {
    "id": "features.instanceRegistry",
    "description": "Manages ~/.luca/agentic-loops/ as a shared registry so multiple luca main processes on the same machine can coexist without port collisions. Instance ID is derived from the CWD basename (e.g. \"@agentic-loop\").",
    "shortcut": "features.instanceRegistry",
    "className": "InstanceRegistry",
    "methods": {
      "ensureDir": {
        "description": "Ensure the registry directory exists",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "listInstances": {
        "description": "Read all currently registered instances",
        "parameters": {},
        "required": [],
        "returns": "InstanceEntry[]"
      },
      "getInstance": {
        "description": "Get a specific instance by ID",
        "parameters": {
          "id": {
            "type": "string",
            "description": "Parameter id"
          }
        },
        "required": [
          "id"
        ],
        "returns": "InstanceEntry | null"
      },
      "getSelf": {
        "description": "Get the entry for the current project, if registered",
        "parameters": {},
        "required": [],
        "returns": "InstanceEntry | null"
      },
      "claimedPorts": {
        "description": "Collect all ports currently claimed by other instances",
        "parameters": {},
        "required": [],
        "returns": "Set<number>"
      },
      "allocatePorts": {
        "description": "Allocate ports for this instance, avoiding collisions with other registered instances and verifying ports are actually open.",
        "parameters": {},
        "required": [],
        "returns": "Promise<InstanceEntry['ports']>"
      },
      "register": {
        "description": "Register this instance with its allocated ports",
        "parameters": {
          "ports": {
            "type": "InstanceEntry['ports']",
            "description": "Parameter ports"
          }
        },
        "required": [
          "ports"
        ],
        "returns": "InstanceEntry"
      },
      "deregister": {
        "description": "Deregister this instance (called on shutdown)",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "pruneStale": {
        "description": "Clean up stale entries whose processes are no longer alive",
        "parameters": {},
        "required": [],
        "returns": "string[]"
      }
    },
    "getters": {
      "registryDir": {
        "description": "",
        "returns": "any"
      },
      "instanceId": {
        "description": "",
        "returns": "string"
      },
      "instanceFile": {
        "description": "",
        "returns": "string"
      }
    },
    "events": {},
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
        "description": "Watch for incoming messages. Emits events: 'message' — new message received (payload: Message) 'error'   — stderr output from imsg watch 'stop'    — watcher was stopped Returns { stop() } to kill the watcher process.",
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
              }
            }
          }
        },
        "required": [],
        "returns": "{ stop: () => void }"
      }
    },
    "getters": {},
    "events": {
      "message": {
        "name": "message",
        "description": "Event emitted by Imsg",
        "arguments": {}
      },
      "error": {
        "name": "error",
        "description": "Event emitted by Imsg",
        "arguments": {}
      },
      "stop": {
        "name": "stop",
        "description": "Event emitted by Imsg",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "examples": [
      {
        "language": "ts",
        "code": "const imsg = container.feature('imsg')\nconst chats = await imsg.chats({ limit: 5 })\nconst messages = await imsg.history(6, { limit: 10 })\nawait imsg.send('+15551234567', 'Hello from luca')"
      }
    ],
    "types": {
      "Chat": {
        "description": "",
        "properties": {
          "id": {
            "type": "number",
            "description": ""
          },
          "name": {
            "type": "string",
            "description": ""
          },
          "identifier": {
            "type": "string",
            "description": ""
          },
          "service": {
            "type": "string",
            "description": ""
          },
          "last_message_at": {
            "type": "string",
            "description": ""
          }
        }
      },
      "HistoryOptions": {
        "description": "",
        "properties": {
          "limit": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "participants": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "start": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "end": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "attachments": {
            "type": "boolean",
            "description": "",
            "optional": true
          }
        }
      },
      "Message": {
        "description": "",
        "properties": {
          "id": {
            "type": "number",
            "description": ""
          },
          "guid": {
            "type": "string",
            "description": ""
          },
          "chat_id": {
            "type": "number",
            "description": ""
          },
          "sender": {
            "type": "string",
            "description": ""
          },
          "text": {
            "type": "string",
            "description": ""
          },
          "is_from_me": {
            "type": "boolean",
            "description": ""
          },
          "created_at": {
            "type": "string",
            "description": ""
          },
          "destination_caller_id": {
            "type": "string",
            "description": ""
          },
          "reactions": {
            "type": "any[]",
            "description": ""
          },
          "attachments": {
            "type": "any[]",
            "description": ""
          }
        }
      },
      "SendResult": {
        "description": "",
        "properties": {
          "success": {
            "type": "boolean",
            "description": ""
          },
          "error": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      },
      "WatchOptions": {
        "description": "",
        "properties": {
          "chatId": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "participants": {
            "type": "string",
            "description": "",
            "optional": true
          },
          "sinceRowid": {
            "type": "number",
            "description": "",
            "optional": true
          },
          "attachments": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "reactions": {
            "type": "boolean",
            "description": "",
            "optional": true
          },
          "debounce": {
            "type": "string",
            "description": "",
            "optional": true
          }
        }
      }
    }
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
    "id": "features.workflowLibrary",
    "description": "WorkflowLibrary helper",
    "shortcut": "features.workflowLibrary",
    "className": "WorkflowLibrary",
    "methods": {
      "afterInitialize": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "discover": {
        "description": "Scan the workflows directory and parse each ABOUT.md",
        "parameters": {},
        "required": [],
        "returns": "Promise<WorkflowInfo[]>"
      },
      "get": {
        "description": "Get a specific workflow by name",
        "parameters": {
          "name": {
            "type": "string",
            "description": "Parameter name"
          }
        },
        "required": [
          "name"
        ],
        "returns": "WorkflowInfo | undefined"
      },
      "listAvailableWorkflows": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ tag?: string }",
            "description": "Parameter options"
          }
        },
        "required": [],
        "returns": "Promise<WorkflowInfo[]>"
      },
      "viewWorkflow": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ name: string }",
            "description": "Parameter options"
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<WorkflowInfo & { content?: string }>"
      },
      "runWorkflow": {
        "description": "",
        "parameters": {
          "options": {
            "type": "{ name: string }",
            "description": "Parameter options"
          }
        },
        "required": [
          "options"
        ],
        "returns": "Promise<{ url: string; pid?: number }>"
      },
      "generateSummary": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "setupToolsConsumer": {
        "description": "",
        "parameters": {
          "assistant": {
            "type": "Assistant",
            "description": "Parameter assistant"
          }
        },
        "required": [
          "assistant"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "workflowsDir": {
        "description": "",
        "returns": "string"
      },
      "workflows": {
        "description": "",
        "returns": "WorkflowInfo[]"
      },
      "isLoaded": {
        "description": "",
        "returns": "boolean"
      },
      "available": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {
      "discovered": {
        "name": "discovered",
        "description": "Event emitted by WorkflowLibrary",
        "arguments": {}
      },
      "workflowStarted": {
        "name": "workflowStarted",
        "description": "Event emitted by WorkflowLibrary",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": [],
    "types": {
      "WorkflowInfo": {
        "description": "",
        "properties": {
          "name": {
            "type": "string",
            "description": ""
          },
          "title": {
            "type": "string",
            "description": ""
          },
          "description": {
            "type": "string",
            "description": ""
          },
          "tags": {
            "type": "string[]",
            "description": ""
          },
          "folderPath": {
            "type": "string",
            "description": ""
          },
          "hasServeHook": {
            "type": "boolean",
            "description": ""
          },
          "hasPublicDir": {
            "type": "boolean",
            "description": ""
          },
          "raw": {
            "type": "Record<string, any>",
            "description": ""
          }
        }
      }
    }
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
        "returns": "VoiceListener"
      },
      "unlock": {
        "description": "Unlock the listener, allowing it to react to wakewords",
        "parameters": {},
        "required": [],
        "returns": "VoiceListener"
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
    ],
    "types": {
      "CapabilityResult": {
        "description": "",
        "properties": {
          "available": {
            "type": "boolean",
            "description": ""
          },
          "missing": {
            "type": "string[]",
            "description": ""
          }
        }
      }
    }
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
  },
  {
    "id": "features.communications",
    "description": "The Communications Feature is a centralized hub that monitors multiple channels for incoming messages, and reacts when they arrive.  The communications feature can also be used to send messages back over those same channels. Supported channels are imessage, telegram, and gmail for now",
    "shortcut": "features.communications",
    "className": "Communications",
    "methods": {
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
      "start": {
        "description": "",
        "parameters": {},
        "required": [],
        "returns": "void"
      },
      "activateChannel": {
        "description": "",
        "parameters": {
          "channelName": {
            "type": "Channel",
            "description": "Parameter channelName"
          },
          "options": {
            "type": "any",
            "description": "Parameter options"
          }
        },
        "required": [
          "channelName",
          "options"
        ],
        "returns": "void"
      }
    },
    "getters": {
      "imessage": {
        "description": "",
        "returns": "any"
      },
      "activeChannels": {
        "description": "",
        "returns": "any"
      },
      "telegramBot": {
        "description": "",
        "returns": "any"
      },
      "isPaused": {
        "description": "",
        "returns": "any"
      },
      "isStarted": {
        "description": "",
        "returns": "any"
      }
    },
    "events": {
      "paused": {
        "name": "paused",
        "description": "Event emitted by Communications",
        "arguments": {}
      },
      "unpaused": {
        "name": "unpaused",
        "description": "Event emitted by Communications",
        "arguments": {}
      },
      "message": {
        "name": "message",
        "description": "Event emitted by Communications",
        "arguments": {}
      },
      "started": {
        "name": "started",
        "description": "Event emitted by Communications",
        "arguments": {}
      }
    },
    "state": {},
    "options": {},
    "envVars": []
  }
];
