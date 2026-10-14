"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, LoaderCircle, Trash2 } from "lucide-react";
import { getProtectedFileURL, pb } from "@/lib/pocketbase";

interface TalkVibeProfile {
  id: string;
  user: string;
  display_name: string;
  username: string;
  talkvibe_id: string;
  bio: string;
  avatar: string;
}

const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const maxPhotoSize = 4 * 1024 * 1024;

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<TalkVibeProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const user = pb.authStore.model;
      if (!pb.authStore.isValid || !user) {
        router.replace("/login");
        return;
      }

      try {
        const loadedProfile = await pb.collection("profiles").getFirstListItem<TalkVibeProfile>(
          `user = "${user.id}"`,
          { requestKey: null },
        );
        if (cancelled) return;

        setProfile(loadedProfile);
        setDisplayName(loadedProfile.display_name);
        setBio(loadedProfile.bio ?? "");

        if (loadedProfile.avatar) {
          const token = await pb.files.getToken({ requestKey: null });
          if (!cancelled) {
            setAvatarUrl(getProtectedFileURL(loadedProfile, loadedProfile.avatar, token, "profiles"));
          }
        }
      } catch (cause) {
        if (!cancelled) {
          console.error(cause);
          setError("Profile load nahi ho payi. Sign in karke dobara try karein.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedPhoto = event.target.files?.[0];
    event.target.value = "";
    if (!selectedPhoto) return;

    if (!allowedPhotoTypes.includes(selectedPhoto.type)) {
      setError("Photo JPG, PNG ya WebP format mein honi chahiye.");
      return;
    }
    if (selectedPhoto.size > maxPhotoSize) {
      setError("Photo ka size 4 MB se kam hona chahiye.");
      return;
    }

    setError("");
    setSuccess("");
    setPhoto(selectedPhoto);
    setRemovePhoto(false);
    setAvatarUrl(URL.createObjectURL(selectedPhoto));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;

    const normalizedName = displayName.trim();
    if (!normalizedName) {
      setError("Display name khali nahi ho sakta.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      formData.set("user", profile.user);
      formData.set("talkvibe_id", profile.talkvibe_id);
      formData.set("display_name", normalizedName);
      formData.set("bio", bio.trim());
      if (photo) {
        formData.set("avatar", photo);
      } else if (removePhoto) {
        formData.set("avatar", "");
      }

      const savedProfile = await pb
        .collection("profiles")
        .update<TalkVibeProfile>(profile.id, formData);
      setProfile(savedProfile);
      setDisplayName(savedProfile.display_name);
      setBio(savedProfile.bio ?? "");
      setPhoto(null);
      setRemovePhoto(false);

      if (savedProfile.avatar) {
        const token = await pb.files.getToken({ requestKey: null });
        const nextAvatarURL = new URL(
          getProtectedFileURL(savedProfile, savedProfile.avatar, token, "profiles"),
        );
        nextAvatarURL.searchParams.set("t", Date.now().toString());
        setAvatarUrl(nextAvatarURL.toString());
      } else {
        setAvatarUrl("");
      }

      setSuccess("Profile update ho gayi.");
    } catch (cause) {
      console.error(cause);
      setError("Profile save nahi ho saki. Connection aur photo format/size check karke phir try karein.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" />
        Profile load ho rahi hai...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Dashboard par wapas
        </Link>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-indigo-500/5 sm:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-indigo-400">Account settings</p>
          <h1 className="mt-2 text-3xl font-semibold">Edit profile</h1>
          <p className="mt-2 text-sm text-slate-400">Apna display name, bio aur profile photo update karein.</p>

          {error ? (
            <p role="alert" className="mt-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
          {success ? (
            <p role="status" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              {success}
            </p>
          ) : null}

          {profile ? (
            <form onSubmit={handleSave} className="mt-7 space-y-6">
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white">
                  {avatarUrl ? (
                    <Image
                      src={avatarUrl}
                      alt="Your profile photo"
                      fill
                      unoptimized
                      className="object-cover"
                      sizes="96px"
                    />
                  ) : (
                    displayName.trim().slice(0, 2).toUpperCase() || "TV"
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm font-medium hover:border-indigo-500/50">
                    <Camera className="h-4 w-4" />
                    {profile.avatar || photo ? "Change photo" : "Add photo"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoChange}
                      className="sr-only"
                    />
                  </label>
                  {profile.avatar || photo ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPhoto(null);
                        setRemovePhoto(true);
                        setAvatarUrl("");
                        setSuccess("");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2.5 text-sm text-slate-300 hover:border-rose-500/50 hover:text-rose-200"
                    >
                      <Trash2 className="h-4 w-4" />
                      Remove
                    </button>
                  ) : null}
                </div>
                <p className="w-full text-xs text-slate-500">JPG, PNG, or WebP · maximum 4 MB · private photo</p>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Display name</span>
                <input
                  required
                  maxLength={80}
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-slate-300">Bio</span>
                <textarea
                  maxLength={500}
                  rows={4}
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                  className="w-full resize-y rounded-2xl border border-slate-700 bg-slate-800 px-3 py-3 outline-none focus:border-indigo-500"
                  placeholder="A little about you..."
                />
                <span className="mt-1 block text-right text-xs text-slate-500">{bio.length}/500</span>
              </label>

              <div className="rounded-2xl border border-slate-800 bg-slate-800/50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">TalkVibe ID</p>
                <p className="mt-1 font-semibold text-indigo-200">{profile.talkvibe_id}</p>
                <p className="mt-1 text-xs text-slate-500">Yeh unique ID fixed hai aur change nahi ki ja sakti.</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-40"
              >
                {saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {saving ? "Saving..." : "Save changes"}
              </button>
            </form>
          ) : (
            <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Is account ke liye TalkVibe profile abhi nahi mili. Dobara account banane ke bajaye pehle PocketBase dashboard mein profile record check karein.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
