import axios from "axios";
import { Base64Encode } from "base64-stream";
import fs from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";

// TODO: update this
const config = {
	workflowId: "",
	appId: "",
	appSecret: "",
};

const axiosClient = axios.create({ baseURL: "https://api.cft.stack.gov.sg" });

async function uploadFiles() {
	try {
		const files = [
			{ name: "file1.png", path: "./files/135.jpg" },
			{ name: "file2.png", path: "./files/715.jpg" },
			{ name: "file3.png", path: "./files/blobcoffee.png" },
		];
		const filePath = "test_file.xml";

		const stream = Readable.from(buildXmlStream(files));
		const fileId = await uploadCFTFile(filePath, stream);

		console.log("Success! Uploaded file:", fileId);
	} catch (error) {
		console.log("Error encountered:", error);
	}
}

async function* buildXmlStream(files) {
	yield "<SampleAttachmentReq>\n";
	yield `<ApplicationID>SomeId</ApplicationID>\n`;
	yield `<dateSent>20240401T131200</dateSent>\n`;

	for (const file of files) {
		yield "<fileAttachment>\n";
		yield `<fileName>${file.name}</fileName>\n`;
		yield "<fileContent>";

		// in the actual implementation, this is streamed from S3
		const stream = fs.createReadStream(file.path);
		const base64EncodeStream = new Base64Encode();
		pipeline(stream, base64EncodeStream).catch(() => {});
		for await (const chunk of base64EncodeStream) {
			yield chunk;
		}

		yield "</fileContent>\n";
		yield "</fileAttachment>\n";
	}

	yield "</SampleAttachmentReq>\n";
}

async function uploadCFTFile(filePath, fileStream) {
	const path = `/v2/workflows/${config.workflowId}/files/${filePath}`;
	const accessToken = await getCFTAccessToken();

	const result = await axiosClient.put(path, fileStream, {
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/octet-stream",
		},
	});

	return result.headers.get("x-cft-file-id");
}

async function getCFTAccessToken() {
	const base64UserPass = Buffer.from(`${config.appId}:${config.appSecret}`).toString("base64");

	const result = await axiosClient.post("v2/auth", undefined, {
		headers: {
			Authorization: `Basic ${base64UserPass}`,
			workflowID: config.workflowId,
		},
		params: { application_type: "backend" },
	});

	return result.data.access_token;
}

uploadFiles();
