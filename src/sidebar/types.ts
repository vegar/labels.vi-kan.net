import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { Update } from "../components/LabelFields";
import type { LabelState, Session } from "../state";
import type { Engine } from "../useEngine";
import type { BuildResult } from "../useLabels";

/** Everything a sidebar layout needs; all layouts edit the same session. */
export interface SidebarProps {
  session: Session;
  setSession: Dispatch<SetStateAction<Session>>;
  /** The selected label. */
  state: LabelState;
  update: Update;
  engine?: Engine;
  builds: Map<string, BuildResult>;
  textDepth: number;
  maxDepth: number;
  /** The text had to shrink below a legible size. */
  shrunk: boolean;
  exportButtons: ReactNode;
}
