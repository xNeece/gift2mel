
/* =========================================================
   MELCITA — MEMORY BOOK / V2.4
   Interactions: cover, book pages, audio, cursor, zoom,
   parallax renders and micro-animations.
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];

  const openingScreen = $("#opening-screen");
  const coverBook = $("#cover-book");
  const openGiftButton = $("#open-gift");
  const mainContent = $("#main-content");

  const backgroundMusic = $("#background-music");
  const musicToggle = $("#music-toggle");
  const musicIcon = $("#music-icon");

  const pages = $$(".page");
  const previousButton = $("#prev-page");
  const nextButton = $("#next-page");
  const pageCounter = $("#page-counter");

  const voiceAudio = $("#voice-audio");
  const voiceButton = $("#voice-button");
  const voiceIcon = $("#voice-icon");
  const voiceText = $("#voice-text");
  const voiceStatus = $("#voice-status");


  /* Reduce visual weight of decorative emojis in headings and text.
     This keeps the typography elegant without removing the personality. */
  function softenEmojis() {
    const emojiPattern = /([\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]+)/gu;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || parent.closest(".custom-cursor") || parent.closest(".title-emoji") ||
              parent.tagName === "SCRIPT" || parent.tagName === "STYLE" || parent.classList.contains("emoji")) {
            return NodeFilter.FILTER_REJECT;
          }
          emojiPattern.lastIndex = 0;
          return emojiPattern.test(node.nodeValue)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);

    nodes.forEach(textNode => {
      const text = textNode.nodeValue;
      const fragment = document.createDocumentFragment();
      let last = 0;
      text.replace(emojiPattern, (match, _g, offset) => {
        if (offset > last) fragment.appendChild(document.createTextNode(text.slice(last, offset)));
        const span = document.createElement("span");
        span.className = "emoji";
        span.textContent = match;
        fragment.appendChild(span);
        last = offset + match.length;
        return match;
      });
      if (last < text.length) fragment.appendChild(document.createTextNode(text.slice(last)));
      textNode.parentNode?.replaceChild(fragment, textNode);
    });
  }

  softenEmojis();

  let currentPage = 0;
  let isAnimating = false;
  let musicStarted = false;
  let musicPausedByUser = false;

  /* =======================================================
     OPENING — physical cover
     ======================================================= */
  openGiftButton?.addEventListener("click", () => {
    if (!openingScreen || !coverBook || openGiftButton.disabled) return;

    openGiftButton.disabled = true;
    document.body.classList.add("book-opening");

    backgroundMusic.volume = 0.35;
    backgroundMusic.play().then(() => {
      musicStarted = true;
      musicPausedByUser = false;
      updateMusicButton();
    }).catch(err => console.log("No se pudo iniciar la música:", err));

    // La primera página queda montada detrás de la tapa antes del giro.
    mainContent.classList.remove("hidden");
    showPage(0);

    requestAnimationFrame(() => {
      openingScreen.classList.add("revealing");
      coverBook.classList.add("is-opening");
    });

    setTimeout(() => openingScreen.classList.add("fade-out"), 2750);
    setTimeout(() => {
      openingScreen.style.display = "none";
      document.body.classList.remove("book-opening");
    }, 3350);
  });

  /* =======================================================
     MUSIC
     ======================================================= */
  musicToggle?.addEventListener("click", async () => {
    if (!backgroundMusic) return;

    if (backgroundMusic.paused) {
      try {
        await backgroundMusic.play();
        musicPausedByUser = false;
        musicStarted = true;
      } catch (err) {
        console.log("No se pudo reproducir la música:", err);
      }
    } else {
      backgroundMusic.pause();
      musicPausedByUser = true;
    }
    updateMusicButton();
  });

  function updateMusicButton() {
    if (!musicToggle || !musicIcon || !backgroundMusic) return;

    const paused = backgroundMusic.paused;
    musicIcon.textContent = paused ? "▶" : "Ⅱ";
    musicToggle.setAttribute(
      "aria-label",
      paused ? "Reproducir música" : "Pausar música"
    );
    musicToggle.title = paused ? "Reproducir música" : "Pausar música";
  }

  backgroundMusic?.addEventListener("play", updateMusicButton);
  backgroundMusic?.addEventListener("pause", updateMusicButton);

  /* =======================================================
     BOOK
     ======================================================= */
  function setPageState(page, state) {
    if (!page) return;
    page.classList.remove("is-current", "is-under", "turn-forward", "turn-back");
    if (state) page.classList.add(state);
  }

  function showPage(index) {
    if (!pages.length) return;
    index = Math.max(0, Math.min(index, pages.length - 1));

    pages.forEach((page, i) => {
      setPageState(page, i === index ? "is-current" : null);
      page.style.zIndex = i === index ? "5" : "1";
    });

    currentPage = index;
    animatePageElements(pages[index]);
    if (pageCounter) pageCounter.textContent = `${index + 1} / ${pages.length}`;
    if (previousButton) previousButton.disabled = index === 0;
    if (nextButton) nextButton.disabled = index === pages.length - 1;
  }

  function changePage(direction) {
    if (isAnimating || !mainContent || mainContent.classList.contains("hidden")) return;

    const targetIndex = currentPage + direction;
    if (targetIndex < 0 || targetIndex >= pages.length) {
      if (direction > 0 && currentPage === pages.length - 1) openEnding();
      return;
    }

    const current = pages[currentPage];
    const target = pages[targetIndex];
    if (!current || !target) return;

    isAnimating = true;
    pages.forEach(page => {
      page.classList.remove("is-current", "is-under", "turn-forward", "turn-back");
      page.style.zIndex = "1";
    });

    if (direction > 0) {
      current.style.zIndex = "6";
      target.style.zIndex = "4";
      target.classList.add("is-under");
      current.classList.add("turn-forward");
    } else {
      current.style.zIndex = "4";
      target.style.zIndex = "6";
      current.classList.add("is-under");
      target.classList.add("turn-back");
    }

    const animatedPage = direction > 0 ? current : target;
    const finish = () => {
      pages.forEach(page => {
        page.classList.remove("is-current", "is-under", "turn-forward", "turn-back");
        page.style.zIndex = "1";
      });
      target.classList.add("is-current");
      target.style.zIndex = "5";
      currentPage = targetIndex;
      animatePageElements(target);
      if (pageCounter) pageCounter.textContent = `${currentPage + 1} / ${pages.length}`;
      if (previousButton) previousButton.disabled = currentPage === 0;
      if (nextButton) { nextButton.disabled = false; nextButton.setAttribute("aria-disabled", currentPage === pages.length - 1 ? "true" : "false"); }
      isAnimating = false;
    };

    animatedPage.addEventListener("animationend", finish, { once: true });
  }

  previousButton?.addEventListener("click", () => changePage(-1));
  nextButton?.addEventListener("click", () => changePage(1));

  document.addEventListener("keydown", event => {
    if (openingScreen && openingScreen.style.display !== "none") return;

    if (event.key === "ArrowRight") changePage(1);
    if (event.key === "ArrowLeft") changePage(-1);

    if (event.code === "Space" && !isTypingTarget(event.target)) {
      event.preventDefault();
      musicToggle?.click();
    }

    if (event.key === "Escape") {
      closeMemoryModal();
      closeEnding();
    }
  });

  function isTypingTarget(element) {
    return ["INPUT", "TEXTAREA", "SELECT"].includes(element?.tagName);
  }

  /* =======================================================
     SWIPE — mobile book feel
     ======================================================= */
  let touchStartX = 0;
  let touchStartY = 0;

  $(".book")?.addEventListener("touchstart", event => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  $(".book")?.addEventListener("touchend", event => {
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;

    if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    changePage(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* =======================================================
     PAGE ELEMENT MICRO ANIMATIONS
     ======================================================= */
  function animatePageElements(page) {
    // La hoja física ya hace la transición. Los elementos internos solo se desplazan,
    // nunca se vuelven transparentes, para evitar parpadeos al cambiar de página.
    const elements = $$(
      ".chapter-number, h2, .page-intro, .memory-text, .horror-text, " +
      ".voice-description, .final-message, .final-signature",
      page
    );

    elements.forEach((element, index) => {
      element.animate(
        [
          { opacity: 1, transform: "translateY(7px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        {
          duration: 360,
          delay: Math.min(index * 28, 160),
          easing: "cubic-bezier(.2,.75,.2,1)",
          fill: "both"
        }
      );
    });
  }

  /* =======================================================
     GALLERY / MEMORY LIGHTBOX
     ======================================================= */
  const modal = $("#memory-modal");
  const modalImage = $("#memory-modal-image");
  const modalCaption = $("#memory-modal-caption");
  const modalClose = $("#memory-modal-close");

    $$(".gallery-card, .memory-image, .horror-image, .hero-card").forEach(card => {
    card.addEventListener("click", event => {
      const image = $("img", card);
      if (!image || !modal || !modalImage) return;

      /* No abrir si el click fue sobre un control interno */
      if (event.target.closest("button")) return;

      const caption =
        $(".gallery-caption", card)?.textContent?.trim() ||
        $(".image-caption", card)?.textContent?.trim() ||
        $("img", card)?.alt ||
        "Un pequeño recuerdo.";

      modalImage.src = image.currentSrc || image.src;
      modalImage.alt = image.alt || "Recuerdo ampliado";
      if (modalCaption) modalCaption.textContent = caption;

      modal.classList.remove("hidden");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";

      requestAnimationFrame(() => modalImage.classList.add("modal-image-visible"));
    });
  });

  function closeMemoryModal() {
    if (!modal || modal.classList.contains("hidden")) return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    if (modalImage) modalImage.classList.remove("modal-image-visible");
  }

  modalClose?.addEventListener("click", closeMemoryModal);
  $(".memory-modal-backdrop")?.addEventListener("click", closeMemoryModal);

  /* =======================================================
     CURSOR — tiny Pompompurin charm
     ======================================================= */
  const customCursor = $("#custom-cursor");
  const cursorRing = $(".cursor-ring", customCursor || document);
  const cursorCharm = $(".cursor-charm", customCursor || document);

  if (customCursor && window.matchMedia("(hover:hover) and (pointer:fine)").matches) {
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener("mousemove", event => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      customCursor.classList.add("visible");

      const interactive = event.target.closest(
        "button, a, .gallery-card, .memory-image, .horror-image, .hero-card"
      );
      customCursor.classList.toggle("cursor-hover", Boolean(interactive));
    }, { passive: true });

    window.addEventListener("mouseleave", () => customCursor.classList.remove("visible"));

    function cursorLoop() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;

      if (cursorRing) {
        cursorRing.style.transform =
          `translate3d(${ringX - mouseX}px,${ringY - mouseY}px,0)`;
      }
      if (cursorCharm) {
        cursorCharm.style.transform =
          `translate3d(${ringX - mouseX + 7}px,${ringY - mouseY + 7}px,0)`;
      }

      customCursor.style.left = `${mouseX}px`;
      customCursor.style.top = `${mouseY}px`;

      requestAnimationFrame(cursorLoop);
    }
    cursorLoop();
  }

/* =======================================================
   PARALLAX / ALTERNATING RENDER MOTION
   ======================================================= */

  $$(".memory-image, .gallery-card").forEach((card, cardIndex) => {

    card.addEventListener("mousemove", event => {
      if (!window.matchMedia("(hover:hover) and (pointer:fine)").matches) return;

      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;

      const image = $("img", card);
      if (!image) return;

      const rotateX = py * -4;
      const rotateY = px * 5;
      const moveX = px * 3;
      const moveY = py * 3;

      image.style.transform =
      `translate3d(${moveX}px,${moveY}px,0) scale(1.025)`;

      card.style.transform =
      `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });

    card.addEventListener("mouseleave", () => {
      const image = $("img", card);

      if (image) {
        image.style.transform = "";
      }

      card.style.transform = "";
    });
  });

  /* =======================================================
     ENDING MESSAGE
     ======================================================= */
  const endingMessage = $("#ending-message");
  const closeEndingButton = $("#close-ending");
  const closeEndingXButton = $("#close-ending-x");

  function openEnding() {
    if (!endingMessage) return;
    endingMessage.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function restartAlbum() {
    /* Volver realmente al estado inicial: tapa cerrada, portada original,
       primera página preparada y audios reiniciados. El tema elegido se
       conserva porque es una preferencia visual independiente del álbum. */
    currentPage = 0;
    isAnimating = false;

    pages.forEach((page, index) => {
      page.classList.toggle("active", index === 0);
      page.classList.remove("turn-out-left", "turn-out-right", "turn-in", "turn-in-back");
    });

    if (pageCounter) pageCounter.textContent = `1 / ${pages.length}`;
    if (previousButton) {
      previousButton.disabled = true;
      previousButton.setAttribute("aria-disabled", "true");
    }
    if (nextButton) {
      nextButton.disabled = false;
      nextButton.setAttribute("aria-disabled", "false");
    }

    if (voiceAudio) {
      voiceAudio.pause();
      voiceAudio.currentTime = 0;
    }
    if (voiceIcon) voiceIcon.textContent = "▶";
    if (voiceText) voiceText.textContent = "Escuchar mi mensaje";
    if (voiceStatus) voiceStatus.textContent = "Cuando estés lista, dale play. ♡";

    if (backgroundMusic) {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    }
    musicStarted = false;
    musicPausedByUser = false;
    updateMusicButton();

    if (endingMessage) endingMessage.classList.add("hidden");
    document.body.style.overflow = "";
    document.body.classList.remove("book-opening");

    if (coverBook) {
      coverBook.classList.remove("is-opening");
      coverBook.style.removeProperty("transform");
    }

    if (openingScreen) {
      openingScreen.style.display = "";
      openingScreen.classList.remove("revealing", "fade-out");
    }
    if (openGiftButton) openGiftButton.disabled = false;

    if (mainContent) mainContent.classList.add("hidden");
  }

  closeEndingButton?.addEventListener("click", restartAlbum);

  // La X solamente cierra el aviso final. No reinicia el álbum, de modo
  // que se puede continuar leyendo desde la página actual.
  closeEndingXButton?.addEventListener("click", () => {
    if (!endingMessage) return;
    endingMessage.classList.add("hidden");
    document.body.style.overflow = "";
  });

  /* =======================================================
     VOICE MESSAGE
     ======================================================= */
  voiceButton?.addEventListener("click", async () => {
    if (!voiceAudio) return;

    if (voiceAudio.paused) {
      if (!backgroundMusic.paused) {
        backgroundMusic.pause();
        musicPausedByUser = false;
      }

      try {
        await voiceAudio.play();
        if (voiceIcon) voiceIcon.textContent = "Ⅱ";
        if (voiceText) voiceText.textContent = "Pausar mi mensaje";
        if (voiceStatus) voiceStatus.textContent = "Escuchando... 🎙️";
      } catch (err) {
        console.log("No se pudo reproducir el mensaje:", err);
      }
    } else {
      voiceAudio.pause();
      if (voiceIcon) voiceIcon.textContent = "▶";
      if (voiceText) voiceText.textContent = "Continuar mi mensaje";
      if (voiceStatus) voiceStatus.textContent = "Pausado. Cuando quieras, seguimos. ♡";
    }
  });

  voiceAudio?.addEventListener("ended", () => {
    if (voiceIcon) voiceIcon.textContent = "↻";
    if (voiceText) voiceText.textContent = "Escuchar de nuevo";
    if (voiceStatus) voiceStatus.textContent = "Y... eso era todo. Ahora sí, seguí con el libro. ♡";

    if (musicStarted && !musicPausedByUser) {
      backgroundMusic.play().catch(() => {});
      updateMusicButton();
    }
  });

  /* Initial state */
  updateMusicButton();
  if (mainContent && !openingScreen) {
    mainContent.classList.remove("hidden");
    showPage(0);
  }
});

/* =======================================================
   V2.5 — THEME TOGGLE + DENSE AMBIENT DECOR
   ======================================================= */
document.addEventListener("DOMContentLoaded", () => {
  const themeToggle = document.querySelector("#theme-toggle");
  const tulipField = document.querySelector("#floating-tulips");
  const themeMeta = document.querySelector('meta[name="theme-color"]');

  const savedTheme = localStorage.getItem("melcita-theme") || "dark";
  document.documentElement.dataset.theme = savedTheme;
  document.body.dataset.theme = savedTheme;

  function syncThemeUI() {
    const light = document.documentElement.dataset.theme === "light";
    themeToggle?.setAttribute("aria-pressed", String(light));
    themeToggle?.setAttribute("aria-label", light ? "Cambiar a modo oscuro" : "Cambiar a modo claro");
    if (themeMeta) themeMeta.setAttribute("content", light ? "#ded4da" : "#28232c");
  }

  themeToggle?.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    document.body.dataset.theme = next;
    localStorage.setItem("melcita-theme", next);
    syncThemeUI();
  });

  if (tulipField && tulipField.children.length < 18) {
    const count = 22;
    for (let i = 0; i < count; i++) {
      const tulip = document.createElement("span");
      tulip.textContent = i % 5 === 0 ? "✿" : "🌷";
      tulip.style.left = `${2 + Math.random() * 96}%`;
      tulip.style.animationDuration = `${13 + Math.random() * 13}s`;
      tulip.style.animationDelay = `${-Math.random() * 20}s`;
      tulip.style.fontSize = `${0.72 + Math.random() * 0.65}rem`;
      tulip.style.opacity = `${0.28 + Math.random() * 0.30}`;
      tulipField.appendChild(tulip);
    }
  }

  syncThemeUI();
});

