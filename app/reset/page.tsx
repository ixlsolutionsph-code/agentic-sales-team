import ResetClient from "./ResetClient";

export default function ResetPage({ searchParams }: { searchParams: { token?: string } }) {
  return <ResetClient token={typeof searchParams.token === "string" ? searchParams.token : ""} />;
}
