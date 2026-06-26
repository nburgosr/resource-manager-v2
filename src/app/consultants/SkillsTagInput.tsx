"use client";

import { useState, useRef } from "react";
import { useSkills } from "./SkillsProvider";

interface Props {
  consultantId: string;
  initialSkills: string[];
  formId: string;
  onTagsChange?: (tags: string[]) => void;
}

export function SkillsTagInput({ consultantId, initialSkills, formId, onTagsChange }: Props) {
  const { allSkills, registerSkill } = useSkills();
  const [tags, setTags] = useState<string[]>(initialSkills);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = `skills-list-${consultantId}`;

  const addTag = (name: string) => {
    const trimmed = name.trim();
    if (trimmed && !tags.includes(trimmed)) {
      const next = [...tags, trimmed];
      setTags(next);
      registerSkill(trimmed);
      onTagsChange?.(next);
    }
    setInput("");
  };

  const removeTag = (name: string) => {
    const next = tags.filter((t) => t !== name);
    setTags(next);
    onTagsChange?.(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (input.trim()) addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (allSkills.includes(val)) {
      addTag(val);
    } else {
      setInput(val);
    }
  };

  return (
    <div
      className="skills-input-wrap"
      onClick={() => inputRef.current?.focus()}
    >
      <input type="hidden" name="skills" value={tags.join(",")} form={formId} />
      {tags.map((tag) => (
        <span key={tag} className="skill-pill">
          {tag}
          <button
            type="button"
            className="skill-pill-remove"
            onClick={(e) => {
              e.stopPropagation();
              removeTag(tag);
            }}
            aria-label={`Quitar ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="text"
        list={listId}
        value={input}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? "Añadir skill…" : ""}
        className="skills-text-input"
        autoComplete="off"
      />
      <datalist id={listId}>
        {allSkills
          .filter((s) => !tags.includes(s))
          .map((s) => (
            <option key={s} value={s} />
          ))}
      </datalist>
    </div>
  );
}
