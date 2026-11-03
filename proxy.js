function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Type": "text/plain; charset=utf-8",
      "WWW-Authenticate": 'Basic realm="DaltonHCAS Private Preview", charset="UTF-8"'
    }
  });
}

function serviceUnavailable() {
  return new Response("Private preview credentials are not configured.", {
    status: 503,
    headers: {
      "Cache-Control": "no-store, private",
      "Content-Type": "text/plain; charset=utf-8"
    }
  });
}

function safeEqual(actual, expected) {
  const left = String(actual ?? "");
  const right = String(expected ?? "");
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function decodeBasicCredentials(header) {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(":");
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1)
    };
  } catch {
    return null;
  }
}

export default function proxy(request) {
  // Generic installation assets must be reachable by the phone's background worker.
  if (["/service-worker.js", "/manifest.webmanifest", "/app-version.json", "/assets/icons/icon-192.png", "/assets/icons/icon-512.png", "/assets/icons/apple-touch-icon.png"].includes(new URL(request.url).pathname)) return new Response(null, { headers: { "x-middleware-next": "1", "Cache-Control": "no-cache" } });
  const expectedUsername = process.env.PREVIEW_USERNAME;
  const expectedPassword = process.env.PREVIEW_PASSWORD;
  if (!expectedUsername || !expectedPassword) return serviceUnavailable();

  const credentials = decodeBasicCredentials(request.headers.get("authorization"));
  if (
    !credentials ||
    !safeEqual(credentials.username, expectedUsername) ||
    !safeEqual(credentials.password, expectedPassword)
  ) {
    return unauthorized();
  }

  return new Response(null, {
    headers: {
      "Cache-Control": "no-store, private",
      "x-middleware-next": "1"
    }
  });
}
