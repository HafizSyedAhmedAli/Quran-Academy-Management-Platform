export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="text-red-600">
      {message}
    </p>
  ) : null;
}
