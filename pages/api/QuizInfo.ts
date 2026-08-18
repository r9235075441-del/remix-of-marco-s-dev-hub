import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import { getHeaders } from "@/utils/auth";
import { authenticateUser, clearAuthCookies } from "@/utils/authenticateUser";

const asString = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const findQuestionList = (value: any): any[] | null => {
  if (!value || typeof value !== "object") return null;

  const directLists = [
    value.questions,
    value.questionDetails,
    value.questionList,
    value.questionIds,
    value.questionsList,
    value.exerciseIds?.flatMap?.((exercise: any) =>
      exercise?.questions ||
      exercise?.questionDetails ||
      exercise?.questionList ||
      exercise?.questionIds ||
      []
    ),
    value.exerciseDetails?.questions,
    value.exerciseDetails?.questionDetails,
    value.test?.questions,
    value.test?.questionDetails,
    value.data?.questions,
    value.data?.questionDetails,
  ];

  for (const list of directLists) {
    if (Array.isArray(list) && list.length) return list;
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      const found = findQuestionList(child);
      if (found?.length) return found;
    }
  }

  return null;
};

const looksLikeId = (value: unknown) =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{8,}$/.test(value);

const collectQuizIds = (value: any, ids = new Set<string>()) => {
  if (!value || typeof value !== "object") return ids;

  for (const [key, child] of Object.entries(value)) {
    const lowerKey = key.toLowerCase();
    const isQuizKey =
      lowerKey.includes("exercise") ||
      lowerKey.includes("quiz") ||
      lowerKey.includes("test") ||
      lowerKey.includes("exam") ||
      lowerKey.includes("external");

    if (isQuizKey && Array.isArray(child)) {
      for (const item of child) {
        if (looksLikeId(item)) {
          ids.add(item);
        }

        if (item && typeof item === "object") {
          const objectIds = [
            (item as any)._id,
            (item as any).id,
            (item as any).externalId,
            (item as any).exerciseId,
            (item as any).quizId,
            (item as any).testId,
            (item as any).examId,
          ];

          for (const objectId of objectIds) {
            if (looksLikeId(objectId)) ids.add(objectId);
          }
        }
      }
    }

    if (isQuizKey && looksLikeId(child as string)) {
      ids.add(child as string);
    }

    if (isQuizKey && child && typeof child === "object") {
      const objectId = (child as any)._id || (child as any).id || (child as any).externalId;
      if (objectId && looksLikeId(objectId)) ids.add(objectId);
    }

    if (child && typeof child === "object") {
      collectQuizIds(child, ids);
    }
  }

  return ids;
};

const getDataShape = (value: any) => {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).slice(0, 40);
};

const getQuizUrls = (PW_API: string, id: string) => [
  `${PW_API}/v1/batches/exercise/${id}`,
  `${PW_API}/v1/batches/exercise/${id}/questions`,
  `${PW_API}/v1/batch-exercises/${id}`,
  `${PW_API}/v1/batch-exercises/${id}/questions`,
  `${PW_API}/v2/batch-exercises/${id}`,
  `${PW_API}/v2/batch-exercises/${id}/questions`,
  `${PW_API}/v1/exercises/${id}`,
  `${PW_API}/v1/exercises/${id}/questions`,
  `${PW_API}/v2/exercises/${id}`,
  `${PW_API}/v2/exercises/${id}/questions`,
  `${PW_API}/v1/online-exams/${id}`,
  `${PW_API}/v1/online-exams/${id}/questions`,
  `${PW_API}/v1/online-exams/exam/${id}`,
  `${PW_API}/v1/online-exams/exam/${id}/questions`,
  `${PW_API}/v2/online-exams/${id}`,
  `${PW_API}/v2/online-exams/${id}/questions`,
  `${PW_API}/v2/online-exams/exam/${id}`,
  `${PW_API}/v3/test-service/test/${id}`,
  `${PW_API}/v3/test-service/test/${id}/questions`,
  `${PW_API}/v3/test-service/tests/${id}`,
  `${PW_API}/v3/test-service/tests/${id}/questions`,
  `${PW_API}/test-service/v1/tests/${id}`,
  `${PW_API}/test-service/v1/tests/${id}/questions`,
  `${PW_API}/v1/tests/${id}`,
  `${PW_API}/v1/tests/${id}/questions`,
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const user = await authenticateUser(req, res);
    const actualToken = user.ActualToken ?? "";
    const PW_API = process.env.PW_API ?? "";

    const batchId = asString(req.query.BatchId);
    const subjectId = asString(req.query.SubjectId);
    const contentId = asString(req.query.ContentId);
    const quizId = asString(req.query.QuizId);

    const errors: string[] = [];
    if (!PW_API) errors.push("`PW_API`");
    if (!batchId) errors.push("`BatchId`");
    if (!subjectId) errors.push("`SubjectId`");
    if (!contentId && !quizId) errors.push("`ContentId` or `QuizId`");

    if (errors.length > 0) {
      return res
        .status(400)
        .json({ message: `Missing or invalid: ${errors.join(", ")}` });
    }

    const failures: string[] = [];
    const discoveredIds = new Set<string>();

    if (quizId) discoveredIds.add(quizId);

    if (contentId) {
      const scheduleUrl = `${PW_API}/v1/batches/${batchId}/subject/${subjectId}/schedule/${contentId}/schedule-details`;

      try {
        const response = await axios.get(scheduleUrl, {
          headers: getHeaders(actualToken),
        });

        const data = response.data?.data ?? response.data;
        const questions = findQuestionList(data);

        if (questions?.length) {
          return res.status(200).json({
            success: true,
            data,
            questions,
            source: scheduleUrl.replace(PW_API!, ""),
          });
        }

        collectQuizIds(data, discoveredIds);
        failures.push(
          `${scheduleUrl.replace(PW_API!, "")}: no questions found; keys=${getDataShape(data).join(",") || "none"}; discoveredIds=${[...discoveredIds].join(",") || "none"}`
        );
      } catch (error: any) {
        failures.push(
          `${scheduleUrl.replace(PW_API!, "")}: ${
            error.response?.data?.message || error.message || "request failed"
          }`
        );
      }
    }

    const candidateUrls = [...discoveredIds].flatMap((id) => getQuizUrls(PW_API!, id));

    for (const url of candidateUrls) {
      try {
        const response = await axios.get(url, {
          headers: getHeaders(actualToken),
        });

        const data = response.data?.data ?? response.data;
        const questions = findQuestionList(data);

        if (questions?.length) {
          return res.status(200).json({
            success: true,
            data,
            questions,
            source: url.replace(PW_API!, ""),
          });
        }

        failures.push(`${url.replace(PW_API!, "")}: no questions found`);
      } catch (error: any) {
        failures.push(
          `${url.replace(PW_API!, "")}: ${
            error.response?.data?.message || error.message || "request failed"
          }`
        );
      }
    }

    return res.status(404).json({
      message:
        "Quiz data was not available from the authenticated PW endpoints this app knows.",
      failures,
    });
  } catch (error: any) {
    const message =
      error.response?.data?.message || error.message || "Error fetching quiz";
    const isAuthError =
      message.toLowerCase().includes("unauthorized") ||
      message.toLowerCase().includes("token");
    const isDbError =
      error.name === "MongooseServerSelectionError" ||
      message.toLowerCase().includes("mongodb") ||
      message.toLowerCase().includes("querysrv") ||
      message.toLowerCase().includes("atlas cluster");
    const status = error.response?.status || (isAuthError ? 401 : isDbError ? 503 : 500);

    if (isAuthError || status === 401) {
      clearAuthCookies(res);
    }

    return res.status(status).json({
      message,
      errorName: error.name || "Error",
    });
  }
}
