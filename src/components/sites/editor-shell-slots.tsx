"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type EditorShellSlots = {
  addHost: HTMLElement | null;
  statusHost: HTMLElement | null;
  layersHost: HTMLElement | null;
  bindAddRef: (node: HTMLElement | null) => void;
  bindStatusRef: (node: HTMLElement | null) => void;
  bindLayersRef: (node: HTMLElement | null) => void;
};

const EditorShellSlotsContext = createContext<EditorShellSlots | null>(null);

export function EditorShellSlotsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [addHost, setAddHost] = useState<HTMLElement | null>(null);
  const [statusHost, setStatusHost] = useState<HTMLElement | null>(null);
  const [layersHost, setLayersHost] = useState<HTMLElement | null>(null);

  const bindAddRef = useCallback((node: HTMLElement | null) => {
    setAddHost(node);
  }, []);
  const bindStatusRef = useCallback((node: HTMLElement | null) => {
    setStatusHost(node);
  }, []);
  const bindLayersRef = useCallback((node: HTMLElement | null) => {
    setLayersHost(node);
  }, []);

  const value = useMemo(
    () => ({
      addHost,
      statusHost,
      layersHost,
      bindAddRef,
      bindStatusRef,
      bindLayersRef,
    }),
    [addHost, statusHost, layersHost, bindAddRef, bindStatusRef, bindLayersRef],
  );

  return (
    <EditorShellSlotsContext.Provider value={value}>
      {children}
    </EditorShellSlotsContext.Provider>
  );
}

export function useEditorShellSlots(): EditorShellSlots {
  const ctx = useContext(EditorShellSlotsContext);
  if (!ctx) {
    return {
      addHost: null,
      statusHost: null,
      layersHost: null,
      bindAddRef: () => undefined,
      bindStatusRef: () => undefined,
      bindLayersRef: () => undefined,
    };
  }
  return ctx;
}
