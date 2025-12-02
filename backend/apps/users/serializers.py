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
    password2 = serializers.CharField(write_only=True, required=True)
    
    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password2', 'role', 'phone']
        extra_kwargs = {
            'role': {'required': True},
        }
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError({"password": "Password fields didn't match."})
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        return user