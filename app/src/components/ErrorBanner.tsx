interface Props {
  title?: string;
  error: unknown;
}

export default function ErrorBanner({ title, error }: Props) {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "Unknown error";
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3">
      <div className="font-medium text-red-800">
        {title ?? "Something went wrong"}
      </div>
      <div className="mt-1 text-sm text-red-700">{msg}</div>
    </div>
  );
}
