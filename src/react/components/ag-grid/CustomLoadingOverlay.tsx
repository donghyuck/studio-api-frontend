import { CircularProgress } from "@mui/material";

export function CustomLoadingOverlay() {
  return (
    <div className="react-grid-loading-overlay">
      <CircularProgress color="primary" size={48} />
    </div>
  );
}
