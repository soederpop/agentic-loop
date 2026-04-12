---
status: parked
---

# Give Assistants Control of Voice Mode Feedback

Currently, we use some event bindings to trigger e.g. thinking phrases while in voice mode, so that while talking to an assistant who is deep in tool calling chains, you don't get left in complete silence wondering if the system is working.

This can get kind of predictable and mechanical.  What if we gave the assistant the ability to play any random phrase tag, but also the ability to narrate their intent and their experience with the tool calling.  

We can prompt it to tell it, hey you're in voice mode, and if you're calling a bunch of tools the user doesn't get any feedback while you're working, so to make it easier on them take time to explain what you're doing.  If you want to just trigger a canned phrase too that's possible too.  Mix it up perhaps.  The canned phrases are usually high quality ones explicitly defined by the user anyway, but if there are too few, sometimes mixing it up helps.


