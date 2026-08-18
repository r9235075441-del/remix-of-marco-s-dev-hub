// utils/fetchWithAuth.ts

export const fetchWithAuth = async (
  input: RequestInfo,
  init: RequestInit = {}
): Promise<Response> => {
  const res = await fetch(input, {
    ...init,
    credentials: "include", // very important to send cookies
  });

  if (res.status === 401 && typeof window !== "undefined") {
    // Clear local storage and redirect to login
    localStorage.removeItem("USER_DATA");
    localStorage.removeItem("enrolledBatches");
    localStorage.removeItem("selectedBatch");
    window.location.href = "/auth";
  }

  return res;
};
