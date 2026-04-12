import { runActiveSavedSearches } from "@/lib/searches/runner";

async function main() {
  const results = await runActiveSavedSearches();
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
