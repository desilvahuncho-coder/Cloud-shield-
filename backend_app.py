import os
import datetime
import boto3
from flask import Flask, request, jsonify
from flask_cors import CORS
from botocore.exceptions import ClientError

app = Flask(__name__)
CORS(app)  # Permits your live GitHub Pages frontend to talk to this API

@app.route('/api/v1/connect-cloud', methods=['POST'])
def connect_cloud():
    data = request.get_json() or {}
    role_arn = data.get("role_arn")
    external_id = data.get("external_id", "CloudShield_Secret_Token_2026")

    if not role_arn or not role_arn.startswith("arn:aws:iam"):
        return jsonify({"status": "ERROR", "message": "Invalid or missing AWS IAM Role ARN structure."}), 400

    try:
        # Step 1: Initialize the Security Token Service (STS) client
        # In production, ensure your hosting environment (Render/Railway) has master AWS credentials configured
        sts_client = boto3.client('sts', region_name='us-east-1')
        
        # Step 2: Execute authentication handshake via Cross-Account AssumeRole
        assumed_role_object = sts_client.assume_role(
            RoleArn=role_arn,
            RoleSessionName="CloudShieldVerificationSession",
            ExternalId=external_id,
            DurationSeconds=3600
        )
        
        # Step 3: Extract temporary secure execution keys
        credentials = assumed_role_object['Credentials']
        
        # Step 4: Re-initialize AWS clients using the temporary secure tokens
        cost_client = boto3.client(
            'ce', # Cost Explorer api identifier
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
            region_name='us-east-1'
        )
        
        ec2_client = boto3.client(
            'ec2', # EC2 Inventory api identifier
            aws_access_key_id=credentials['AccessKeyId'],
            aws_secret_access_key=credentials['SecretAccessKey'],
            aws_session_token=credentials['SessionToken'],
            region_name='us-east-1'
        )

        # Step 5: Read Live AWS Cost Explorer Data (Last 7 Days)
        end_date = datetime.date.today()
        start_date = end_date - datetime.timedelta(days=7)
        
        cost_response = cost_client.get_cost_and_usage(
            TimePeriod={
                'Start': start_date.strftime('%Y-%m-%d'),
                'End': end_date.strftime('%Y-%m-%d')
            },
            Granularity='DAILY',
            Metrics=['UnblendedCost']
        )
        
        # Parse spending telemetry
        spending_history = []
        for time_period in cost_response.get('ResultsByTime', []):
            spending_history.append({
                "date": time_period['TimePeriod']['Start'],
                "cost_usd": float(time_period['Total']['UnblendedCost']['Amount'])
            })

        # Step 6: Read Live Active Compute Instances (EC2 Inventory)
        ec2_response = ec2_client.describe_instances(
            Filters=[{'Name': 'instance-state-name', 'Values': ['running']}]
        )
        
        active_instances = []
        for reservation in ec2_response.get('Reservations', []):
            for instance in reservation.get('Instances', []):
                # Extract instance name if present in tags
                name_tag = next((tag['Value'] for tag in instance.get('Tags', []) if tag['Key'] == 'Name'), 'Unnamed')
                active_instances.append({
                    "instance_id": instance['InstanceId'],
                    "type": instance['InstanceType'],
                    "launch_time": instance['LaunchTime'].isoformat(),
                    "name": name_tag
                })

        # Return real parsed JSON structural telemetry back to the client
        return jsonify({
            "status": "SUCCESS",
            "message": "AWS Account validated and read successfully.",
            "data": {
                "role_verified": role_arn,
                "total_active_ec2_count": len(active_instances),
                "active_instances_inventory": active_instances,
                "seven_day_cost_history": spending_history
            }
        }), 200

    except ClientError as err:
        return jsonify({
            "status": "ERROR", 
            "message": f"AWS Authentication/Permissions Denied: {err.response['Error']['Message']}"
        }), 401
    except Exception as e:
        return jsonify({"status": "ERROR", "message": f"API Internal Error: {str(e)}"}), 500

if __name__ == '__main__':
    # Binds to internal port 5000 for local testing and cloud execution routing
    app.run(host='0.0.0.0', port=5000, debug=True)
