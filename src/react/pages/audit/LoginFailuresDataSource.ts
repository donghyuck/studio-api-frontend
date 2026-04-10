import { ReactPageDataSource } from "@/react/pages/admin/datasource";
import type { LoginFailureEvent } from "@/react/pages/audit/loginFailuresApi";

export class LoginFailuresDataSource extends ReactPageDataSource<LoginFailureEvent> {
  constructor() {
    super("/api/mgmt/audit/login-failure-log");
  }
}
