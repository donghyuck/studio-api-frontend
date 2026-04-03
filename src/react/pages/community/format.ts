import dayjs from "dayjs";

export function formatDateTime(value?: string) {
  if (!value) {
    return "-";
  }

  return dayjs(value).format("YYYY-MM-DD HH:mm:ss");
}

const topicStatusLabels: Record<string, string> = {
  OPEN: "공개",
  HIDDEN: "숨김",
  LOCKED: "잠금",
  PINNED: "고정",
};

export function formatTopicStatus(value?: string) {
  if (!value) {
    return "공개";
  }

  return topicStatusLabels[value] ?? value;
}
