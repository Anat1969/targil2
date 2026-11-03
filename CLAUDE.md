# CLAUDE.md

## A&I logo button
The top bar holds only the app name (links home), content navigation, and ONE logo button "אד' ענת שטיבלמן A&I" (`<ai-menu>` from https://appofapp-gh.vercel.app/ai-menu.js). Every editing and development action (העתקת קישור, שיחת הפיתוח, פרויקט המחקר, התקנת האפליקציה, edit mode, add, delete) lives only inside it, never as loose buttons. Standard: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-menu-standard.md

## בעלות ולוגו
אפליקציה של העירייה (`data.owner = "ashdod"` בתיק האפליקציות).

## הנפח על המגרש (03.11.2026)
- מתחת לתוצאות של `index.html`: הרכיב המשותף `<space-walk>` מ-https://appofapp-gh.vercel.app/walk.js, ואם Vercel לא עונה, מ-Pages של AppOfApp-GH. התקן: https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/walk-standard.md
- התוכנית נבנית מהשדות בכל הקלדה (`updateWalk`): מגרש ריבועי מול רחוב, ושני מצבים עם אותן זכויות: "הקומות המבוקשות" ו"במלוא התכסית". התכסית המותרת מסומנת בצהוב על המגרש.
- הנחות גלויות בכלל שבמסך: גובה קומה 3.2 מ', שכנים בני 4 קומות לקנה מידה בלבד. בלי קווי בניין.
- טופס ריק מציג דוגמה מסומנת (מגרש 1,000 מ"ר, 40%, 160%, 8 קומות).
- בדיקה: `python3 -m http.server 8092 & node tests/walk.e2e.mjs`.

## פריסה
- Pages מוגש מהענף `gh-pages`. ה-Action `sync-pages.yml` מעתיק לשם את `index.html` בכל דחיפה לענף ברירת המחדל.
- `taba.html` לא מועתק: בגרסה שב-`gh-pages` יש חילוץ דרישות שלא קיים בענף ברירת המחדל. איחוד שני הקבצים הוא משימה נפרדת.

## יומן תיקונים
- 03.11.2026: נוסף "הנפח על המגרש", מתוך רייל על spaceplanner.co, בבקשת ענת להרחיב את ההליכה בגובה העיניים לעוד אפליקציות.
- 03.11.2026: נמצא ש-Pages הציג את גרסת יולי, כולל בלי כפתור A&I. נוסף סנכרון של `index.html` ל-`gh-pages`.
