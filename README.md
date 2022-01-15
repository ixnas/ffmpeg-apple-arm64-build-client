# ffmpeg-apple-arm64-build-client

Builds ffmpeg binaries for Apple Silicon and posts them to a WordPress blog using the REST API.

It's mostly a shell script wrapped in JavaScript, but I used JavaScript because it's easier to work with JSON that way. It uses my fork of [this](https://github.com/Vargol/ffmpeg-apple-arm64-build) build script to actually build the ffmpeg binaries.

You need an Apple Silicon Mac to use this script.

I post new ffmpeg builds every Wednesday. You can download them [here](https://sjoerdscheffer.nl/ffmpeg-builds).

## Instructions
- Create a config.json file that looks like this:
```json
{
	"url": "https://mywordpressblog.com",
	"username": "username",
	"password": "password",
	"category": "5"
}
```
- Run `npm start`.
- Wait for a while.
- Done!