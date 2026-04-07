## Remember these "Layouts"

When the user asks you to spawn a "Layout" , e.g "Rocket, spawn, launch, pop open, whatever **the SETUP layout**" then you should look here for how the user wants them arranged and which workflows you need to spawn.

### Setup Layout

For this you need the following workflows to be launched: `setup`, `comms`, `wakeword-setup`, `voice-designer`

```json
[
  {
    "url": "http://localhost:7700/workflows/setup/",
    "x": 0,
    "y": 0,
    "width": 700,
    "height": 972
  },
  {
    "url": "http://localhost:7700/workflows/comms/",
    "x": 487,
    "y": 9,
    "width": 629,
    "height": 494
  },
  {
    "url": "http://localhost:7700/workflows/wakeword-setup/",
    "x": 1127,
    "y": 10,
    "width": 648,
    "height": 509
  },
  {
    "url": "http://localhost:7700/workflows/voice-designer/",
    "x": 502,
    "y": 532,
    "width": 1272,
    "height": 569
  }
]
```
