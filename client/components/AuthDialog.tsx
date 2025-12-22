"use client";

import React, { useState } from "react";
import {
  Dialog,
  Button,
  Flex,
  TextField,
  Text,
  Callout,
} from "@radix-ui/themes";
import { useAuth } from "@/contexts/AuthContext";
import { AlertCircle, Mail, Lock, User } from "lucide-react";

export function AuthDialog({ children }: { children: React.ReactNode }) {
  const [isLogin, setIsLogin] = useState(true);
  const [open, setOpen] = useState(false);
  const { login, register, loading } = useAuth();

  // Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      setOpen(false);
      // Reset form
      setEmail("");
      setPassword("");
      setName("");
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setError(null);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger>{children}</Dialog.Trigger>

      <Dialog.Content style={{ maxWidth: 450 }}>
        <Dialog.Title>
          {isLogin ? "Welcome Back" : "Create Account"}
        </Dialog.Title>
        <Dialog.Description size="2" mb="4">
          {isLogin
            ? "Enter your credentials to access your account."
            : "Sign up to start saving your favorite stations."}
        </Dialog.Description>

        <form onSubmit={handleSubmit}>
          <Flex direction="column" gap="3">
            {/* Error Message */}
            {error && (
              <Callout.Root color="red" size="1">
                <Callout.Icon>
                  <AlertCircle size={16} />
                </Callout.Icon>
                <Callout.Text>{error}</Callout.Text>
              </Callout.Root>
            )}

            {/* Name Field (Register only) */}
            {!isLogin && (
              <label>
                <Text as="div" size="2" mb="1" weight="bold">
                  Name
                </Text>
                <TextField.Root
                  placeholder="Your Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                >
                  <TextField.Slot>
                    <User height="16" width="16" />
                  </TextField.Slot>
                </TextField.Root>
              </label>
            )}

            {/* Email/Username Field */}
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                {isLogin ? "Email or Username" : "Email"}
              </Text>
              <TextField.Root
                placeholder={isLogin ? "john@example.com" : "john@example.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              >
                <TextField.Slot>
                  <Mail height="16" width="16" />
                </TextField.Slot>
              </TextField.Root>
            </label>

            {/* Password Field */}
            <label>
              <Text as="div" size="2" mb="1" weight="bold">
                Password
              </Text>
              <TextField.Root
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              >
                <TextField.Slot>
                  <Lock height="16" width="16" />
                </TextField.Slot>
              </TextField.Root>
            </label>

            <Flex gap="3" mt="4" justify="end">
              <Dialog.Close>
                <Button variant="soft" color="gray">
                  Cancel
                </Button>
              </Dialog.Close>
              <Button type="submit" loading={loading}>
                {isLogin ? "Sign In" : "Sign Up"}
              </Button>
            </Flex>
          </Flex>
        </form>

        <Flex justify="center" mt="4">
          <Text size="2" color="gray">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <span
              className="text-blue-500 cursor-pointer hover:underline"
              onClick={toggleMode}
            >
              {isLogin ? "Sign Up" : "Log In"}
            </span>
          </Text>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
