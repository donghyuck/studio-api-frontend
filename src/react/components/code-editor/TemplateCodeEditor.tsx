import { useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { javascript } from "@codemirror/lang-javascript";
import { java } from "@codemirror/lang-java";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import {
  Box,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
} from "@mui/material";
import type { Extension } from "@codemirror/state";

export type EditorLanguage =
  | "html"
  | "css"
  | "javascript"
  | "java"
  | "json"
  | "markdown"
  | "text";

const LANGUAGE_OPTIONS: { value: EditorLanguage; label: string }[] = [
  { value: "html", label: "HTML / FreeMarker / Mustache" },
  { value: "css", label: "CSS" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "json", label: "JSON" },
  { value: "markdown", label: "Markdown" },
  { value: "text", label: "Plain Text" },
];

function getExtensions(language: EditorLanguage, wordWrap: boolean): Extension[] {
  const langExt: Extension[] = [];
  switch (language) {
    case "html":
      langExt.push(html());
      break;
    case "css":
      langExt.push(css());
      break;
    case "javascript":
      langExt.push(javascript());
      break;
    case "java":
      langExt.push(java());
      break;
    case "json":
      langExt.push(json());
      break;
    case "markdown":
      langExt.push(markdown());
      break;
  }
  if (wordWrap) {
    langExt.push(EditorView.lineWrapping);
  }
  return langExt;
}

interface TemplateCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: EditorLanguage;
  onLanguageChange: (language: EditorLanguage) => void;
}

export function TemplateCodeEditor({
  value,
  onChange,
  language,
  onLanguageChange,
}: TemplateCodeEditorProps) {
  const [wordWrap, setWordWrap] = useState(false);

  return (
    <Box
      sx={(theme) => ({
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        transition: "border-color 0.15s",
        "&:focus-within": {
          borderColor: theme.palette.primary.main,
        },
      })}
    >
      {/* 툴바 */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "grey.50",
          flexWrap: "wrap",
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ mr: "auto", fontWeight: 500 }}>
          본문 (body)
        </Typography>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={wordWrap}
              onChange={(e) => setWordWrap(e.target.checked)}
            />
          }
          label={<Typography variant="caption">Word wrap</Typography>}
          sx={{ mr: 0 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel id="editor-lang-label">언어</InputLabel>
          <Select
            labelId="editor-lang-label"
            label="언어"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value as EditorLanguage)}
            sx={{ fontSize: 13 }}
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
                {opt.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* 에디터 */}
      <Box
        sx={{
          "& .cm-editor": { fontSize: 13 },
          "& .cm-editor.cm-focused": { outline: "none" },
        }}
      >
        <CodeMirror
          value={value}
          height="400px"
          extensions={getExtensions(language, wordWrap)}
          onChange={onChange}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            autocompletion: true,
            bracketMatching: true,
            highlightActiveLine: true,
          }}
        />
      </Box>
    </Box>
  );
}
