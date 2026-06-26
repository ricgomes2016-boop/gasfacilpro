package com.gasfacilpro.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String ALERT_CHANNEL_ID = "gasfacil_alerts_v3";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        createImportantNotificationChannel();
        super.onCreate(savedInstanceState);
    }

    private void createImportantNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager notificationManager = getSystemService(NotificationManager.class);
        if (notificationManager == null) return;

        Uri soundUri = Uri.parse(
            ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + R.raw.gasfacil_alert
        );

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        NotificationChannel channel = new NotificationChannel(
            ALERT_CHANNEL_ID,
            "Notificações Importantes",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Novos pedidos, chats e alertas do entregador");
        channel.setSound(soundUri, audioAttributes);
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        notificationManager.createNotificationChannel(channel);
    }
}
