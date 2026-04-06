import {
  Dialog,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  ROLE_PERMISSION_ACTIONS,
  rolePermissionRows,
} from "@/data/studio/mgmt/forums";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ForumRoleMatrixGuide({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>포럼 역할 권한 안내</DialogTitle>
      <DialogContent>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>역할</TableCell>
                <TableCell>기본 설명</TableCell>
                <TableCell>관리 설명</TableCell>
                {ROLE_PERMISSION_ACTIONS.map((action) => (
                  <TableCell key={action} align="center">
                    {action}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rolePermissionRows.map((row) => (
                <TableRow key={row.role} hover>
                  <TableCell>{row.label}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>{row.basic}</TableCell>
                  <TableCell sx={{ minWidth: 260 }}>{row.admin}</TableCell>
                  {ROLE_PERMISSION_ACTIONS.map((action) => (
                    <TableCell key={`${row.role}-${action}`} align="center">
                      {row.grantedActions.includes(action) ||
                      row.adminActions?.includes(action)
                        ? "Y"
                        : "-"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </DialogContent>
    </Dialog>
  );
}
