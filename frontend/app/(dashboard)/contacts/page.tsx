import type { Metadata } from "next";
import { ContactsPage } from "@/components/contacts/ContactsPage";

export const metadata: Metadata = { title: "Contacts" };

export default function Page() {
  return <ContactsPage />;
}
