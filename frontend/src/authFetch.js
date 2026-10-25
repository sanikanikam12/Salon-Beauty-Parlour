// Adds the signed login token to API requests without changing each component.
const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init = {}) => {
  const inheritedHeaders =
    typeof Request !== "undefined" && input instanceof Request
      ? input.headers
      : undefined;

  const headers = new Headers(init.headers ?? inheritedHeaders);

  try {
    const savedUser = JSON.parse(
      window.localStorage.getItem("user") || "null"
    );
    if (savedUser?.token) {
      headers.set("Authorization", `Bearer ${savedUser.token}`);
    }
  } catch {
    // Requests without a saved user continue without an auth token.
  }

  return nativeFetch(input, { ...init, headers });
};
