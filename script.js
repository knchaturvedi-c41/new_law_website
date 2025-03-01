document.addEventListener("DOMContentLoaded", function () {
    const popup = document.getElementById("popup");
    const popupFrame = document.getElementById("popup-frame");
    const closePopup = document.querySelector(".close-popup");
    const fullscreenBtn = document.querySelector(".fullscreen-popup");
    const links = document.querySelectorAll(".open-popup");

    // Hide popup on page load
    popup.style.display = "none";

    // Open popup when a document link is clicked
    links.forEach(link => {
        link.addEventListener("click", function (event) {
            event.preventDefault();
            let fileUrl = this.href;

            // Check if file is a PPTX
            if (fileUrl.endsWith(".pptx") || fileUrl.endsWith(".ppt")) {
                fileUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
            }

            popup.style.display = "flex"; // Show popup
            popupFrame.src = fileUrl; // Load document into iframe
        });
    });

    // Close popup
    closePopup.addEventListener("click", function () {
        popup.style.display = "none";
        popupFrame.src = ""; // Clear iframe when closing
    });

    // Close popup when clicking outside content
    popup.addEventListener("click", function (event) {
        if (event.target === popup) {
            popup.style.display = "none";
            popupFrame.src = "";
        }
    });

    // Fullscreen toggle
    fullscreenBtn.addEventListener("click", function () {
        const popupContent = document.querySelector(".popup-content");
        if (popupContent.classList.contains("fullscreen")) {
            popupContent.classList.remove("fullscreen"); // Exit fullscreen
        } else {
            popupContent.classList.add("fullscreen"); // Enter fullscreen
        }
    });
});



document.addEventListener("DOMContentLoaded", function () {
    let slideIndex = 0;
    const slides = document.querySelectorAll(".slide");

    if (slides.length === 0) {
        console.error("No slides found. Check your HTML and image paths.");
        return;
    }

    function showSlides() {
        slides.forEach(slide => slide.style.display = "none"); // Hide all slides
        slideIndex = (slideIndex + 1) % slides.length; // Move to the next slide
        slides[slideIndex].style.display = "block"; // Show the current slide
        setTimeout(showSlides, 3000); // Change image every 3 seconds
    }

    slides[0].style.display = "block"; // Ensure the first image is visible
    setTimeout(showSlides, 3000); // Start the slideshow

    // Attach event listeners for manual navigation
    document.querySelector(".prev").addEventListener("click", function () {
        slideIndex = (slideIndex - 1 + slides.length) % slides.length;
        showSlides();
    });

    document.querySelector(".next").addEventListener("click", function () {
        slideIndex = (slideIndex + 1) % slides.length;
        showSlides();
    });
});
