"use client";

import { useEffect, useState } from "react";
import HLSPlayer from "@/app/components/HLSPlayer";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function LivePage() {
  const [url, seturl] = useState<string | null>(null);
  const [signedUrl, setsignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const batchId = params.get("batchId");
    const subjectId = params.get("SubjectId");
    const childId = params.get("ChildId");
    const titleParam = params.get("title");
    if (titleParam) setTitle(decodeURIComponent(titleParam));

    if (!batchId || !subjectId || !childId) {
      const err = "Missing required query parameters.";
      toast.error(err);
      setErrorMsg(err);
      setLoading(false);
      return;
    }

    const promise = toast.promise(
      fetch(
        `/api/get-video-url?batchId=${batchId}&subjectId=${subjectId}&childId=${childId}`
      ).then(async (res) => {
        const data = await res.json();
        if (!data.success) {
          throw new Error(
            data.message || "Failed to fetch video EROR_CODE_902"
          );
        }
        const videoData = data.data;

        if (!videoData.url || !videoData.signedUrl) {
          throw new Error("Invalid video URL response from server");
        }

        seturl(videoData.url);
        setsignedUrl(videoData.signedUrl);
        return data;
      }),
      {
        loading: "Loading live class...",
        success: "Live class loaded!",
        error: (err) => {
          setErrorMsg(err.message || "Error loading live class");
          return err.message || "Error loading live class";
        },
      }
    );

    promise.unwrap().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-white bg-black">
        <span>Loading live class...</span>
      </div>
    );
  }

  if (errorMsg || !url || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black gap-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition"
        >
          <ArrowLeft className="w-5 h-5" />
          Go Back
        </button>
        <p className="text-red-400 text-center px-4">
          {errorMsg || "Unknown error occurred."}
        </p>
      </div>
    );
  }

  return (
    <HLSPlayer
      baseUrl={url}
      signedQuery={signedUrl}
      title={title || undefined}
      isLiveStream={true}
    />
  );
}
