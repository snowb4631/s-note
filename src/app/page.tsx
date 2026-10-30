import { connection } from "next/server";
import { CardEditor } from "@/components/CardEditor";
import { emailEnabled } from "@/server/env";

export default async function Home() {
  await connection(); // env is read per request so turning email on needs no rebuild
  return <CardEditor emailEnabled={emailEnabled(process.env)} />;
}
