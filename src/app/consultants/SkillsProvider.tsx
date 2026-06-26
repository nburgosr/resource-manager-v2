"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface SkillsContextType {
  allSkills: string[];
  registerSkill: (name: string) => void;
}

const SkillsContext = createContext<SkillsContextType>({
  allSkills: [],
  registerSkill: () => {},
});

export function SkillsProvider({
  initialSkills,
  children,
}: {
  initialSkills: string[];
  children: ReactNode;
}) {
  const [allSkills, setAllSkills] = useState<string[]>(initialSkills);

  const registerSkill = (name: string) => {
    setAllSkills((prev) => {
      if (prev.includes(name)) return prev;
      return [...prev, name].sort((a, b) => a.localeCompare(b));
    });
  };

  return (
    <SkillsContext.Provider value={{ allSkills, registerSkill }}>
      {children}
    </SkillsContext.Provider>
  );
}

export const useSkills = () => useContext(SkillsContext);
