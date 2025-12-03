from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'role', 
            'avatar', 'phone', 'is_online', 'last_seen',
            'date_joined', 'last_login'
        ]
        read_only_fields = ['is_online', 'last_seen', 'date_joined', 'last_login']


class UserProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['username', 'email', 'role', 'avatar', 'phone']
        read_only_fields = ['email', 'role']


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        validators=[validate_password]
    )
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'role', 'phone']
        extra_kwargs = {
            'role': {'required': True},
            'phone': {'required': False, 'allow_blank': True},
        }
    
    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user