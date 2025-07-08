// Firebase SDK の設定 (YOUR_... をご自身のFirebaseプロジェクトの設定に置き換えてください)
const firebaseConfig = {
  apiKey: "AIzaSyCxivLH3aSmFig_pxXUHW8oKWJEAelft0A",
  authDomain: "syukketu2025.firebaseapp.com",
  projectId: "syukketu2025",
  storageBucket: "syukketu2025.firebasestorage.app",
  messagingSenderId: "801167181140",
  appId: "1:801167181140:web:fb6a4cdf05420ebb00b4c1"
};

// Firebase を初期化
firebase.initializeApp(firebaseConfig);

// Firebase サービスの参照を取得
const auth = firebase.auth();
const db = firebase.firestore();

// DOM要素の取得
const uidInput = document.getElementById('uid');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const currentUserStatus = document.getElementById('currentUserStatus');
const attendanceList = document.getElementById('attendanceList');
const adminSection = document.getElementById('adminSection');
const newDateInput = document.getElementById('newDateInput');
const addDateBtn = document.getElementById('addDateBtn');
const newEventTitleInput = document.getElementById('newEventTitle');

let currentUserId = null;
let isAdmin = false; // 管理者フラグ

// 任意のUIDからダミーのメールアドレスを生成する関数
function generateDummyEmail(customUid) {
    // ドメインは実際には存在しない、このアプリ専用のものであることが望ましい
    return `${customUid}@syukketu.com`; 
}

// --- 認証関連 ---

// ユーザーログイン状態の監視
auth.onAuthStateChanged(async user => {
    console.log("onAuthStateChanged: ユーザー状態が変更されました。", user); // デバッグログ
    if (user) {
        currentUserId = user.uid;
        console.log("onAuthStateChanged: ログイン中のユーザーUID:", currentUserId); // デバッグログ
        
        try {
            const userDoc = await db.collection('users').doc(user.uid).get();
            console.log("onAuthStateChanged: Firestore usersコレクションからユーザー情報を取得しました。", userDoc.exists); // デバッグログ
            if (userDoc.exists) {
                const userData = userDoc.data();
                currentUserStatus.textContent = `ログイン中: ${userData.displayName} (ID: ${userData.customId})`;
                
                const idTokenResult = await user.getIdTokenResult(true); 
                isAdmin = !!idTokenResult.claims.admin;
                adminSection.style.display = isAdmin ? 'block' : 'none';
                console.log("onAuthStateChanged: 管理者権限:", isAdmin); // デバッグログ
            } else {
                currentUserStatus.textContent = `ログイン中: ${user.uid}`;
                isAdmin = false;
                adminSection.style.display = 'none';
                console.log("onAuthStateChanged: Firestoreにユーザーデータが見つかりませんでした。", user.uid); // デバッグログ
            }
        } catch (error) {
            console.error("onAuthStateChanged: ユーザー情報の取得中にエラー:", error); // デバッグログ
            currentUserStatus.textContent = `ログイン中: ${user.uid}`;
            isAdmin = false;
            adminSection.style.display = 'none';
        }

        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        uidInput.style.display = 'none';
        passwordInput.style.display = 'none';

        loadEvents();

    } else {
        currentUserId = null;
        isAdmin = false;
        currentUserStatus.textContent = 'ログアウト中';
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        uidInput.style.display = 'inline-block';
        passwordInput.style.display = 'inline-block';
        adminSection.style.display = 'none';
        attendanceList.innerHTML = '<p>ログインして出欠状況を確認してください。</p>';
        console.log("onAuthStateChanged: ユーザーがログアウトしました。"); // デバッグログ
    }
});

// ログインボタンのイベントリスナー (変更なし、デバッグログ追加なし)
loginBtn.addEventListener('click', async () => {
    const customUid = uidInput.value.trim();
    const password = passwordInput.value;
    if (!customUid || !password) {
        alert('IDとパスワードを入力してください。');
        return;
    }

    const email = generateDummyEmail(customUid);

    try {
        await auth.signInWithEmailAndPassword(email, password);
        alert('ログインしました！');
    } catch (error) {
        let errorMessage = 'ログイン失敗: 不明なエラー';
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = 'IDまたはパスワードが間違っています。';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = '複数回のログイン試行がありました。しばらくしてから再度お試しください。';
        }
        alert(errorMessage);
        console.error("ログインエラー:", error); // エラーオブジェクト全体を出力
    }
});

// 新規登録ボタンのイベントリスナー
signupBtn.addEventListener('click', async () => {
    const customUid = uidInput.value.trim();
    const password = passwordInput.value;
    if (!customUid || !password) {
        alert('IDとパスワードを入力してください。');
        return;
    }

    const email = generateDummyEmail(customUid);
    console.log("新規登録試行: customUid =", customUid, "生成されたメールアドレス =", email); // デバッグログ

    try {
        // まず、このcustomUidが既にFirestoreに存在しないかチェック
        // これは`request.auth`に依存しないため、通常はFirestoreルールでブロックされない
        const existingUserDoc = await db.collection('users').doc(customUid).get();
        if (existingUserDoc.exists) {
            alert('このIDは既に使われています。');
            console.warn("新規登録試行: IDがFirestoreに既に存在します。", customUid); // デバッグログ
            return;
        }
        console.log("新規登録試行: Firestoreに既存IDは見つかりませんでした。"); // デバッグログ

        // Firebase Authentication にメールアドレスとパスワードで登録
        console.log("新規登録試行: createUserWithEmailAndPassword を実行中..."); // デバッグログ
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        console.log("新規登録試行: createUserWithEmailAndPassword 成功。", "Auth UID:", user.uid); // デバッグログ

        // Firestore にユーザー情報を保存（ドキュメントIDはFirebase AuthのUID）
        console.log("新規登録試行: Firestore usersコレクションへの書き込みを実行中..."); // デバッグログ
        await db.collection('users').doc(user.uid).set({
            customId: customUid, // ユーザーが入力した任意のIDを保存
            displayName: customUid, // 表示名として使用
            email: email, // ダミーメールアドレスを保存
            isAdmin: false // デフォルトは管理者ではない
        });
        console.log("新規登録試行: Firestore usersコレクションへの書き込み成功。"); // デバッグログ

        alert('新規登録が完了しました！');
    } catch (error) {
        let errorMessage = '新規登録失敗: 不明なエラー';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'このID（メールアドレス）は既に使われています。';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'パスワードが弱すぎます。6文字以上で設定してください。';
        } else if (error.code === 'auth/invalid-email') {
             errorMessage = '無効なID形式です。';
        } else if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
             errorMessage = '権限不足により新規登録できませんでした。Firestoreのセキュリティルールを確認してください。';
        }
        alert(errorMessage);
        console.error("新規登録エラー:", error); // エラーオブジェクト全体を出力
        console.error("エラーコード:", error.code); // エラーコードを明示的に出力
        console.error("エラーメッセージ:", error.message); // エラーメッセージを明示的に出力
    }
});

// ログアウトボタンのイベントリスナー (変更なし)
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        alert('ログアウトしました！');
        attendanceList.innerHTML = '<p>ログインして出欠状況を確認してください。</p>';
    } catch (error) {
        alert(`ログアウト失敗: ${error.message}`);
        console.error("ログアウトエラー:", error);
    }
});

// --- イベント（日付）管理 ---

// 2025年4月から2026年3月までの毎週日曜日をプリセット
// (この関数は管理者権限があるユーザーが初回に実行する想定)
async function generatePresetSundays() {
    if (!isAdmin) {
        alert('管理者権限がありません。');
        return;
    }
    const startDate = new Date('2025-04-01T00:00:00');
    const endDate = new Date('2026-03-31T23:59:59');
    const sundayEvents = [];

    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        if (currentDate.getDay() === 0) {
            const dateString = currentDate.toISOString().split('T')[0];
            sundayEvents.push({
                date: firebase.firestore.Timestamp.fromDate(new Date(dateString + 'T00:00:00')), 
                title: '定例イベント', 
                createdBy: 'system' 
            });
        }
        currentDate.setDate(currentDate.getDate() + 1); 
    }

    for (const event of sundayEvents) {
        const querySnapshot = await db.collection('events')
            .where('date', '==', event.date)
            .get();
        if (querySnapshot.empty) {
            await db.collection('events').add(event);
            console.log(`プリセット日を追加: ${event.date.toDate().toLocaleDateString()}`);
        }
    }
    alert('プリセット日を生成・追加しました。');
}

// イベント（日付）の読み込みと表示 (変更なし)
function loadEvents() {
    if (!currentUserId) return;

    attendanceList.innerHTML = '<p>イベントを読み込み中...</p>';

    db.collection('events')
        .orderBy('date', 'asc')
        .onSnapshot(async (snapshot) => {
            const events = [];
            snapshot.forEach(doc => {
                events.push({ id: doc.id, ...doc.data() });
            });

            attendanceList.innerHTML = '';

            if (events.length === 0) {
                attendanceList.innerHTML = '<p>イベントがありません。</p>';
                return;
            }

            for (const event of events) {
                const eventDate = event.date.toDate();
                const eventDateString = eventDate.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short'
                });

                const eventDiv = document.createElement('div');
                eventDiv.className = 'date-item';
                eventDiv.innerHTML = `
                    <h3>${eventDateString} - ${event.title || 'イベント'}</h3>
                    <div class="attendance-input" data-event-id="${event.id}">
                        <label><input type="radio" name="status-${event.id}" value="〇"> 〇（参加可能）</label>
                        <label><input type="radio" name="status-${event.id}" value="遅刻"> 遅刻</label>
                        <label><input type="radio" name="status-${event.id}" value="早退"> 早退</label>
                        <label><input type="radio" name="status-${event.id}" value="×"> ×（参加不可）</label>
                        <input type="time" name="time-${event.id}" style="display: none;">
                        <button class="submit-attendance-btn" data-event-id="${event.id}">入力</button>
                    </div>
                    <div id="currentAttendance-${event.id}"></div>
                `;
                attendanceList.appendChild(eventDiv);

                await loadUserAttendance(event.id, currentUserId);
            }
            addEventListenersToAttendanceForms();
        }, (error) => {
            console.error("イベント読み込みエラー:", error);
            attendanceList.innerHTML = '<p>イベントの読み込み中にエラーが発生しました。</p>';
        });
}

// 管理者による日付追加 (変更なし)
addDateBtn.addEventListener('click', async () => {
    if (!isAdmin) {
        alert('管理者権限がありません。');
        return;
    }
    const newDate = newDateInput.value;
    const newEventTitle = newEventTitleInput.value.trim();
    if (!newDate) {
        alert('日付を選択してください。');
        return;
    }

    try {
        const dateObj = new Date(newDate + 'T00:00:00');
        const docRef = await db.collection('events').add({
            date: firebase.firestore.Timestamp.fromDate(dateObj),
            title: newEventTitle || '追加イベント',
            createdBy: currentUserId
        });
        alert(`日付 '${newDate}' を追加しました！ (ID: ${docRef.id})`);
        newDateInput.value = '';
        newEventTitleInput.value = '';
    } catch (error) {
        alert(`日付の追加に失敗: ${error.message}`);
        console.error("日付追加エラー:", error);
    }
});

// --- 出欠入力関連 --- (変更なし)

function addEventListenersToAttendanceForms() {
    document.querySelectorAll('.attendance-input').forEach(inputDiv => {
        const eventId = inputDiv.dataset.eventId;
        const statusRadios = inputDiv.querySelectorAll(`input[name="status-${eventId}"]`);
        const timeInput = inputDiv.querySelector(`input[name="time-${eventId}"]`);

        statusRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                if (radio.value === '遅刻' || radio.value === '早退') {
                    timeInput.style.display = 'inline-block';
                    timeInput.required = true;
                } else {
                    timeInput.style.display = 'none';
                    timeInput.required = false;
                    timeInput.value = '';
                }
            });
        });
    });

    document.querySelectorAll('.submit-attendance-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const eventId = e.target.dataset.eventId;
            const inputDiv = e.target.closest('.attendance-input');
            const selectedStatusRadio = inputDiv.querySelector(`input[name="status-${eventId}"]:checked`);
            const timeInput = inputDiv.querySelector(`input[name="time-${eventId}"]`);

            if (!selectedStatusRadio) {
                alert('出欠を選択してください。');
                return;
            }

            const status = selectedStatusRadio.value;
            let time = null;
            if (status === '遅刻' || status === '早退') {
                time = timeInput.value;
                if (!time) {
                    alert('時間を入力してください。');
                    return;
                }
            }

            try {
                const querySnapshot = await db.collection('attendance')
                    .where('eventId', '==', eventId)
                    .where('userId', '==', currentUserId)
                    .get();

                if (!querySnapshot.empty) {
                    const docIdToUpdate = querySnapshot.docs[0].id;
                    await db.collection('attendance').doc(docIdToUpdate).update({
                        status: status,
                        time: time,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert('出欠を更新しました！');
                } else {
                    await db.collection('attendance').add({
                        eventId: eventId,
                        userId: currentUserId,
                        status: status,
                        time: time,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                    alert('出欠を入力しました！');
                }
                loadUserAttendance(eventId, currentUserId);
            } catch (error) {
                alert(`出欠の入力/更新に失敗: ${error.message}`);
                console.error("出欠入力エラー:", error);
            }
        });
    });
}

// ユーザーの現在の出欠状況をロードして表示 (変更なし)
async function loadUserAttendance(eventId, userId) {
    const attendanceDocRef = await db.collection('attendance')
        .where('eventId', '==', eventId)
        .where('userId', '==', userId)
        .get();

    const currentAttendanceDiv = document.getElementById(`currentAttendance-${eventId}`);
    currentAttendanceDiv.innerHTML = '';

    if (!attendanceDocRef.empty) {
        const attendanceData = attendanceDocRef.docs[0].data();
        let displayString = `あなたの出欠: <strong>${attendanceData.status}</strong>`;
        if (attendanceData.time) {
            displayString += ` (${attendanceData.time})`;
        }
        currentAttendanceDiv.innerHTML = displayString;

        const inputDiv = document.querySelector(`.attendance-input[data-event-id="${eventId}"]`);
        if (inputDiv) {
            const statusRadios = inputDiv.querySelectorAll(`input[name="status-${eventId}"]`);
            const timeInput = inputDiv.querySelector(`input[name="time-${eventId}"]`);

            statusRadios.forEach(radio => {
                if (radio.value === attendanceData.status) {
                    radio.checked = true;
                }
            });
            if (attendanceData.time) {
                timeInput.value = attendanceData.time;
                timeInput.style.display = 'inline-block';
            } else {
                timeInput.style.display = 'none';
            }
        }
    } else {
        currentAttendanceDiv.textContent = 'あなたの出欠: 未入力';
    }
}