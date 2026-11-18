import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { OrgMark } from "@/components/org-mark";
import { orgKindLabel, sampleOrganizations } from "@/lib/organizations";

export const metadata: Metadata = { title: "Organisations" };

/** Groups that organise their own problem-solving work on Unstuck. */
export default function Organizations() {
  return (
    <div className="frame directory">
      <header className="editorial-head">
        <div>
          <h1>Organisations</h1>
          <p>
            Co-operatives, labs, nonprofits and teams working on problems
            together. Their people keep the credit for what they share.
          </p>
        </div>
      </header>
      <p className="example-notice">
        <span className="example-tag">Sample data</span> Organisation accounts
        are a template for now. These three show how they’ll work.
      </p>
      <ul className="ws-grid org-grid">
        {sampleOrganizations.map((o) => (
          <li key={o.id}>
            <Link className="ws-card org-card" href={`/organizations/${o.id}`}>
              <span className="org-top">
                <OrgMark name={o.name} />
                <span className="org-kind">{orgKindLabel[o.kind]}</span>
              </span>
              <strong>{o.name}</strong>
              <small>{o.tagline}</small>
              <span className="ws-stats">
                <span>
                  <MapPin size={13} aria-hidden="true" /> {o.place}
                </span>
                <span>
                  <Users size={13} aria-hidden="true" /> {o.members.length}{" "}
                  people
                </span>
                <span>{o.problems.length + o.workspaces.length} projects</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
