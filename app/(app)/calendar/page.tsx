import { createClient } from "@/lib/supabase/server";
import { ensureWorkspace } from "@/lib/workspace";
import { buildCalendarEvents, currentMonth } from "@/lib/calendar";
import { CalendarView } from "@/components/calendar/calendar-view";
import { redirect } from "next/navigation";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month: monthParam } = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(monthParam ?? "") ? monthParam! : currentMonth();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const workspace = await ensureWorkspace(supabase, user);
  const events = workspace ? await buildCalendarEvents(supabase, workspace.id, month) : [];

  return <CalendarView month={month} events={events} />;
}
