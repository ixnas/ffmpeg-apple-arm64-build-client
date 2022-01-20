"use strict";

const { spawn } = require("child_process");
const fs = require("fs");
const { chdir } = require("process");

// eslint-disable-next-line no-undef
const ROOT_DIR = __dirname;

const config = readConfig();

const LOG_FILE = ROOT_DIR + "/out.log";
const USER = config.username;
const PASSWD = config.password;
const URL = config.url;
const POST_STATUS = "publish";
const POST_CATEGORY = config.category;

function readConfig() 
{
	const file = fs.readFileSync(ROOT_DIR + "/config.json");
	const jsonString = file.toString();
	return JSON.parse(jsonString);
}

function runCommand(command, args, print = false, err = false) 
{
	return new Promise((resolve) => 
	{
		let totalOut = "";
		const ls = spawn(command, args);
		ls.stdout.on("data", (data) => 
		{
			totalOut += data.toString();
			if (print)
				console.log(data.toString());
			fs.appendFileSync(LOG_FILE, data);
		});
		ls.stderr.on("data", (data) => 
		{
			if (err)
				totalOut += data.toString();
			if (print)
				console.log(data.toString());
			fs.appendFileSync(LOG_FILE, data);
		});
		ls.on("exit", () => 
		{
			resolve(totalOut);
		});
	});
}

async function main() 
{
	console.log("\n --- Downloading build scripts...");
	await setupRepo();

	console.log("\n --- Building...");
	await build();

	console.log("\n --- Collecting build information...");
	const data1 = await getBuildInfo();

	console.log("\n --- Uploading build...");
	const data2 = await sendAttachment(data1);

	console.log("\n --- Creating blog post...");
	await sendPost(data2);

	console.log("\n --- Writing build information...");
	writeBuildInformation(data2);

	console.log("\n --- Cleaning up...\n");
	await cleanUp(data2.attachment.filename);
}

async function getBuildInfo() 
{
	return {
		ffmpeg: await getFFmpegData(),
		libs: await getVersions(),
		attachment: await getAttachmentData()
	};
}

async function cleanUp(filename) 
{
	chdir(ROOT_DIR);
	await runCommand("mv", ["./ffmpeg-apple-arm64-build/ffmpeg-success.zip", `${filename}`]);
	await runCommand("rm", ["-rf", "ffmpeg-apple-arm64-build"]);
}

function writeBuildInformation(data) 
{
	const jsonString = JSON.stringify(data, null, "\t");
	fs.appendFileSync(`${ROOT_DIR}/${data.attachment.filename}.json`, jsonString);
}

async function setupRepo() 
{
	await runCommand("git", ["clone", "http://github.com/ixnas/ffmpeg-apple-arm64-build", "--depth", "1"]);
}

async function build() 
{
	chdir("./ffmpeg-apple-arm64-build");
	await runCommand("./build.sh");
}

async function getFFmpegData() 
{
	return {
		version: await getFFmpegVersion(),
		config: await getFFmpegConfig(),
	};
}

async function sendAttachment(data) 
{
	const { attachment } = data;
	const output = await runCommand("curl", [
		"--user",
		`${USER}:${PASSWD}`,
		"-X",
		"POST",
		"-H",
		`Content-Disposition: form-data; filename=${attachment.filename}`,
		"-F",
		`file=@${attachment.path};filename=${attachment.filename}`,
		`${URL}/wp-json/wp/v2/media`
	]);

	const response = JSON.parse(output);

	return {
		...data,
		attachment: {
			...attachment,
			id: response.id,
			url: response.guid.raw
		},
	};
}

async function sendPost(data) 
{
	data.post = await getPost(data.attachment.id, data.attachment.url);
	const post = JSON.stringify(data.post);
	await runCommand("curl", [
		"--user",
		`${USER}:${PASSWD}`,
		"-X",
		"POST",
		"-H",
		"Content-Type: application/json",
		"-d",
		post,
		`${URL}/wp-json/wp/v2/posts`
	], false);
}

async function getPost(attachmentId, attachmentUrl) 
{
	return {
		title: await getPostTitle(),
		content: await getPostContent(await getFFmpegConfig(), await getVersions(), attachmentId, attachmentUrl),
		status: POST_STATUS,
		categories: [POST_CATEGORY]
	};
}

async function getPostTitle() 
{
	const version = await getFFmpegVersion();
	return `FFmpeg ${version}`;
}

async function getPostContent(ffmpegConfig, libs, attachmentId, attachmentUrl) 
{
	let tableContents = "";
	for (const libName in libs) 
	{
		const libVersion = libs[libName];
		const tableEntry = `<tr><td>${libName}</td><td>${libVersion}</td></tr>`;
		tableContents += tableEntry;
	}
	return `<!-- wp:file {"id":${attachmentId},"href":"${attachmentUrl}"} -->
<div class="wp-block-file"><a href="${attachmentUrl}" class="wp-block-file__button" download>Download</a></div>
<!-- /wp:file -->

<!-- wp:code -->
<pre class="wp-block-code"><code>${ffmpegConfig}</code></pre>
<!-- /wp:code -->

<!-- wp:table {"className":"is-style-stripes"} -->
<figure class="wp-block-table is-style-stripes"><table><thead><tr><th>Library</th><th>Version</th></tr></thead><tbody>${tableContents}</tbody></table></figure>
<!-- /wp:table -->`;
}

async function getAttachmentData() 
{
	return {
		path: "./ffmpeg-success.zip",
		filename: `ffmpeg-apple-arm64-${(await getFFmpegVersion())}.zip`
	};
}

async function getFFmpegConfig() 
{
	const out = await runCommand("./out/bin/ffmpeg", undefined, false, true);
	const splitted = out.split("\n");
	return splitted[1] + "\n" + splitted[2];
}

async function getFFmpegVersion() 
{
	const out = await runCommand("cat", ["./ffmpeg/ffmpeg/VERSION"]);
	return out.split("\n")[0];
}

async function getVersions() 
{
	// eslint-disable-next-line no-undef
	process.env.TZ = "UTC0";

	return {
		aom: await getGitVersion("./aom/aom"),
		openh264: await getGitVersion("./openh264/openh264"),
		x264: await getGitVersion("./x264/x264"),
		x265: await getGitVersion("./x265/x265_git"),
		vpx: await getGitVersion("./vpx/libvpx"),
		lame: "3.100",
		opus: "1.3.1",
		vorbis: await getGitVersion("./vorbis/vorbis"),
		"svt-av1": await getGitVersion("./svt-av1/SVT-AV1"),
		libass: await getGitVersion("./libass/libass"),
		soxr: await getGitVersion("./soxr/soxr"),
		openjpeg: await getGitVersion("./openjpeg/openjpeg"),
		"avisynth+": await getGitVersion("./avisynthplus/AviSynthPlus"),
		xvid: await getSnapshotVersion("./xvid")
	};
}

async function getGitVersion(dir) 
{
	const oldDir = (await runCommand("pwd")).split("\n")[0];
	chdir(dir);
	const out = await runCommand("git", ["show", "-s", "--format=%cd", "--date=local", "HEAD"]);
	chdir(oldDir);
	return "master (" + out.split("\n")[0] + " UTC)";
}

async function getSnapshotVersion(dir)
{
	const oldDir = (await runCommand("pwd")).split("\n")[0];
	chdir(dir);
	const out = await runCommand("ls");
	chdir(oldDir);
	return "snapshot (" + out.split("\n")[0] + ")";
}

main();