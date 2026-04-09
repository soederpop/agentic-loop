# Fix Web-Chat Rendering

Feel free to use your browser-use skill.

You can spawn the web-chat with `luca web-chat --open-browser` and it will report what it is on.  

I don't like how chat rendering is happening, it keeps appending in one element while the tool calls element above it grows.  I'd rather see the chat and the tool calls sequentially as they happen.  The chat output also should be rendered as proper markdown ( when it is done ).  It is fine to render plain text as it streams in to avoid rendering malformed markdown.