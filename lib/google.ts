import { google } from "googleapis";

export function getGoogleAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

export async function addCalendarEvent(params: {
  memberName: string;
  memberPhone: string;
  className: string;
  classTime: string;
}) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!calendarId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) return;

  const auth = getGoogleAuth();
  const calendar = google.calendar({ version: "v3", auth });

  const start = new Date(params.classTime);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // 1 hour duration

  await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: `${params.className} — ${params.memberName}`,
      description: `Member: ${params.memberName}\nPhone: ${params.memberPhone}`,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
    },
  });
}

export async function appendLeadToSheet(params: {
  name: string;
  phone: string;
  interest: string;
  notes: string;
}) {
  const sheetId = process.env.GOOGLE_LEADS_SHEET_ID;
  if (!sheetId || !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) return;

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const timestamp = new Date().toLocaleString("en-US", { timeZone: "UTC" });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:E",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[timestamp, params.name, params.phone, params.interest ?? "", params.notes ?? ""]],
    },
  });
}
