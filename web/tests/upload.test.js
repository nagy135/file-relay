import assert from "node:assert/strict";
import test from "node:test";
import { sendFile } from "../assets/upload/request.js";

class TestRequest {
  constructor() {
    this.upload = {};
    TestRequest.latest = this;
  }
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  send(body) {
    this.body = body;
  }
}
test("upload transport posts one file and forwards progress, result and completion", (t) => {
  const previous = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = TestRequest;
  t.after(() => {
    if (previous === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = previous;
  });
  const events = [];
  const file = new File(["payload"], "test.txt");
  sendFile(file, {
    onProgress: (v) => events.push(v),
    onSuccess: (v) => events.push(v),
    onError: (v) => events.push(v),
    onComplete: () => events.push("complete"),
  });
  const xhr = TestRequest.latest;
  assert.equal(xhr.method, "POST");
  assert.equal(xhr.url, "/upload");
  assert.deepEqual([...xhr.body.keys()], ["file"]);
  assert.equal(xhr.body.get("file").name, "test.txt");
  xhr.upload.onprogress({ lengthComputable: true, loaded: 3, total: 6 });
  xhr.status = 201;
  xhr.response = { url: "https://relay.example/file" };
  xhr.onload();
  xhr.onloadend();
  assert.deepEqual(events, [50, xhr.response, "complete"]);
});
test("HTTP and network failures do not invoke upload success", (t) => {
  const previous = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = TestRequest;
  t.after(() => {
    if (previous === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = previous;
  });
  const errors = [];
  sendFile(new File(["payload"], "test.txt"), {
    onProgress: () => {},
    onSuccess: () => assert.fail("unexpected success"),
    onError: (v) => errors.push(v),
    onComplete: () => {},
  });
  const xhr = TestRequest.latest;
  xhr.status = 503;
  xhr.response = { error: "busy; retry shortly" };
  xhr.onload();
  xhr.onerror();
  xhr.ontimeout();
  assert.deepEqual(errors, [
    "busy; retry shortly",
    "Upload failed. Check your connection and try again.",
    "Upload timed out. Try again.",
  ]);
});

test("chosen expiry is sent as a POST form parameter without changing the file", (t) => {
  const previous = globalThis.XMLHttpRequest;
  globalThis.XMLHttpRequest = TestRequest;
  t.after(() => {
    if (previous === undefined) delete globalThis.XMLHttpRequest;
    else globalThis.XMLHttpRequest = previous;
  });
  const file = new File(["payload"], "month.txt");
  sendFile(
    file,
    {
      onProgress: () => {},
      onSuccess: () => {},
      onError: () => {},
      onComplete: () => {},
    },
    2592000,
  );
  const xhr = TestRequest.latest;
  assert.equal(xhr.url, "/upload");
  assert.deepEqual([...xhr.body.keys()], ["file", "expires_in"]);
  assert.equal(xhr.body.get("expires_in"), "2592000");
  assert.equal(xhr.body.get("file").name, file.name);
  assert.equal(xhr.body.get("file").size, file.size);
});
